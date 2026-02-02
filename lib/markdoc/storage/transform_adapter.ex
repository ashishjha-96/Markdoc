defmodule Markdoc.Storage.TransformAdapter do
  @moduledoc """
  Storage adapter that adds transparent compression and encryption.

  This adapter wraps the underlying storage mechanism (disk or S3) and applies
  compression (zlib) and encryption (AES-256-GCM) to all stored data.

  ## Data Format

  Encrypted payload structure (binary):
  ```
  [version:1 byte][iv:12 bytes][tag:16 bytes][ciphertext:N bytes]
  ```

  - **Version**: `0x01` for compressed+encrypted, `0x02` for compressed-only
  - **IV**: Random 12 bytes per write (for encrypted data)
  - **Tag**: GCM authentication tag (for encrypted data)
  - **Ciphertext**: Encrypted compressed JSON

  ## Backwards Compatibility

  The adapter detects legacy unencrypted JSON data (starting with `{`) and reads
  it transparently. New writes always use the configured format.

  ## Configuration

  - `:encryption_key` - 32-byte binary key for AES-256-GCM (required for encryption)
  - `:compression_enabled` - boolean, defaults to true
  - `:storage_type` - `:disk` or `:s3`
  - `:path` - disk storage path (for disk type)
  - `:bucket` - S3 bucket name (for S3 type)
  - `:prefix` - S3 key prefix (for S3 type)
  """

  @behaviour Markdoc.Storage.Adapter

  alias Markdoc.Storage.Adapter

  # Version bytes for format detection
  @version_compressed_encrypted 0x01
  @version_compressed_only 0x02

  # AES-256-GCM parameters
  @iv_bytes 12
  @tag_bytes 16

  @impl Adapter
  def load(doc_id, opts) do
    storage_type = Keyword.fetch!(opts, :storage_type)
    key = Keyword.get(opts, :encryption_key)

    case read_raw(doc_id, storage_type, opts) do
      {:ok, raw_data} ->
        decode_and_decrypt(raw_data, key)

      :not_found ->
        :not_found

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl Adapter
  def persist(payload, opts) do
    storage_type = Keyword.fetch!(opts, :storage_type)
    key = Keyword.get(opts, :encryption_key)
    compress? = Keyword.get(opts, :compression_enabled, true)

    # Serialize the payload to JSON
    serialized = serialize_payload(payload)

    case Jason.encode(serialized) do
      {:ok, json} ->
        # Apply compression if enabled
        data = if compress?, do: :zlib.compress(json), else: json

        # Apply encryption if key is provided, otherwise just tag the format
        final =
          if key do
            encrypt(data, key)
          else
            tag_unencrypted(data, compress?)
          end

        write_raw(payload.doc_id, payload.created_at, final, storage_type, opts)

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl Adapter
  def delete(doc_id, opts) do
    storage_type = Keyword.fetch!(opts, :storage_type)
    delete_raw(doc_id, storage_type, opts)
  end

  @impl Adapter
  def list_stale(cutoff_unix, opts) do
    storage_type = Keyword.fetch!(opts, :storage_type)
    list_stale_raw(cutoff_unix, storage_type, opts)
  end

  ## Raw Storage Operations - Disk

  defp read_raw(doc_id, :disk, opts) do
    path = Keyword.fetch!(opts, :path)
    file_path = Path.join(path, "#{doc_id}.enc")

    case File.read(file_path) do
      {:ok, data} -> {:ok, data}
      {:error, :enoent} -> try_legacy_read(doc_id, path)
      {:error, reason} -> {:error, reason}
    end
  end

  defp read_raw(doc_id, :s3, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    key = object_key(doc_id, opts)

    case ExAws.S3.get_object(bucket, key) |> ExAws.request() do
      {:ok, %{body: body}} ->
        {:ok, body}

      {:error, {:http_error, 404, _}} ->
        try_legacy_s3_read(doc_id, bucket, opts)

      {:error, reason} ->
        {:error, reason}
    end
  end

  defp write_raw(doc_id, created_at, data, :disk, opts) do
    path = Keyword.fetch!(opts, :path)
    File.mkdir_p!(path)

    file_path = Path.join(path, "#{doc_id}.enc")
    meta_path = Path.join(path, "#{doc_id}.enc.meta")
    tmp_path = file_path <> ".tmp"
    meta_tmp = meta_path <> ".tmp"

    meta = %{"doc_id" => doc_id, "created_at" => created_at}

    with {:ok, meta_json} <- Jason.encode(meta),
         :ok <- File.write(tmp_path, data),
         :ok <- File.write(meta_tmp, meta_json),
         :ok <- File.rename(tmp_path, file_path),
         :ok <- File.rename(meta_tmp, meta_path) do
      :ok
    else
      {:error, reason} ->
        File.rm(tmp_path)
        File.rm(meta_tmp)
        {:error, reason}
    end
  end

  defp write_raw(doc_id, created_at, data, :s3, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    key = object_key(doc_id, opts)
    marker_key = marker_key(created_at, doc_id, opts)

    with {:ok, _} <-
           ExAws.S3.put_object(bucket, key, data,
             content_type: "application/octet-stream",
             metadata: %{"created-at" => Integer.to_string(created_at)}
           )
           |> ExAws.request(),
         {:ok, _} <-
           ExAws.S3.put_object(bucket, marker_key, "",
             content_type: "application/octet-stream"
           )
           |> ExAws.request() do
      :ok
    else
      {:error, reason} -> {:error, reason}
    end
  end

  defp delete_raw(doc_id, :disk, opts) do
    path = Keyword.fetch!(opts, :path)
    file_path = Path.join(path, "#{doc_id}.enc")
    meta_path = Path.join(path, "#{doc_id}.enc.meta")

    results = [
      safe_delete(file_path),
      safe_delete(meta_path),
      # Also try to delete legacy files
      safe_delete(Path.join(path, "#{doc_id}.json")),
      safe_delete(Path.join(path, "#{doc_id}.meta.json"))
    ]

    case Enum.find(results, &match?({:error, _}, &1)) do
      nil -> :ok
      error -> error
    end
  end

  defp delete_raw(doc_id, :s3, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    key = object_key(doc_id, opts)
    legacy_key = legacy_object_key(doc_id, opts)
    marker_prefix_val = marker_prefix(opts)

    # Delete both encrypted and legacy keys
    results = [
      ExAws.S3.delete_object(bucket, key) |> ExAws.request() |> normalize_delete_result(),
      ExAws.S3.delete_object(bucket, legacy_key) |> ExAws.request() |> normalize_delete_result()
    ]

    # Delete marker objects
    marker_results =
      ExAws.S3.list_objects_v2(bucket, prefix: marker_prefix_val)
      |> ExAws.stream!()
      |> Stream.filter(fn %{key: k} -> String.ends_with?(k, "/#{doc_id}") end)
      |> Enum.map(fn %{key: k} ->
        ExAws.S3.delete_object(bucket, k) |> ExAws.request() |> normalize_delete_result()
      end)

    all_results = results ++ marker_results

    case Enum.find(all_results, &match?({:error, _}, &1)) do
      nil -> :ok
      error -> error
    end
  end

  defp list_stale_raw(cutoff_unix, :disk, opts) do
    path = Keyword.fetch!(opts, :path)

    with {:ok, entries} <- File.ls(path) do
      docs =
        entries
        |> Enum.filter(&String.ends_with?(&1, ".enc.meta"))
        |> Enum.reduce([], fn file, acc ->
          meta_path = Path.join(path, file)

          case File.read(meta_path) do
            {:ok, body} ->
              case Jason.decode(body) do
                {:ok, %{"created_at" => created_at, "doc_id" => doc_id}}
                when created_at <= cutoff_unix ->
                  [doc_id | acc]

                _ ->
                  acc
              end

            _ ->
              acc
          end
        end)

      {:ok, docs}
    else
      {:error, :enoent} -> {:ok, []}
      {:error, reason} -> {:error, reason}
    end
  end

  defp list_stale_raw(cutoff_unix, :s3, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    created_prefix = marker_prefix(opts)
    cutoff_str = pad_ts(cutoff_unix)

    stale_ids =
      ExAws.S3.list_objects_v2(bucket, prefix: created_prefix)
      |> ExAws.stream!()
      |> Stream.filter(fn %{key: key} -> String.starts_with?(key, created_prefix) end)
      |> Stream.map(& &1.key)
      |> Stream.transform([], fn key, acc ->
        relative = String.replace_prefix(key, created_prefix, "")

        case String.split(relative, "/", parts: 2) do
          [ts_str, doc_id] ->
            cond do
              ts_str <= cutoff_str -> {[doc_id | acc], acc}
              ts_str > cutoff_str -> {:halt, acc}
              true -> {[], acc}
            end

          _ ->
            {[], acc}
        end
      end)
      |> Enum.to_list()
      |> Enum.uniq()

    {:ok, stale_ids}
  rescue
    e -> {:error, e}
  end

  # Try to read legacy unencrypted format (disk)
  defp try_legacy_read(doc_id, path) do
    data_path = Path.join(path, "#{doc_id}.json")
    meta_path = Path.join(path, "#{doc_id}.meta.json")

    with {:ok, data_body} <- File.read(data_path),
         {:ok, meta_body} <- File.read(meta_path) do
      # Return combined legacy format for decoding
      {:ok, {:legacy, meta_body, data_body}}
    else
      {:error, :enoent} -> :not_found
      {:error, reason} -> {:error, reason}
    end
  end

  # Try to read legacy unencrypted format (S3)
  defp try_legacy_s3_read(doc_id, bucket, opts) do
    key = legacy_object_key(doc_id, opts)

    case ExAws.S3.get_object(bucket, key) |> ExAws.request() do
      {:ok, %{body: body}} ->
        {:ok, body}

      {:error, {:http_error, 404, _}} ->
        :not_found

      {:error, reason} ->
        {:error, reason}
    end
  end

  ## Encryption/Decryption

  defp encrypt(data, key) when is_binary(key) and byte_size(key) == 32 do
    iv = :crypto.strong_rand_bytes(@iv_bytes)

    {ciphertext, tag} =
      :crypto.crypto_one_time_aead(
        :aes_256_gcm,
        key,
        iv,
        data,
        <<>>,
        @tag_bytes,
        true
      )

    <<@version_compressed_encrypted, iv::binary-size(@iv_bytes), tag::binary-size(@tag_bytes),
      ciphertext::binary>>
  end

  defp encrypt(_data, key) when is_binary(key) do
    raise ArgumentError,
          "Encryption key must be exactly 32 bytes (256 bits), got #{byte_size(key)} bytes"
  end

  defp decrypt(
         <<@version_compressed_encrypted, iv::binary-size(@iv_bytes),
           tag::binary-size(@tag_bytes), ciphertext::binary>>,
         key
       )
       when is_binary(key) and byte_size(key) == 32 do
    case :crypto.crypto_one_time_aead(
           :aes_256_gcm,
           key,
           iv,
           ciphertext,
           <<>>,
           tag,
           false
         ) do
      plaintext when is_binary(plaintext) ->
        {:ok, plaintext}

      :error ->
        {:error, :decryption_failed}
    end
  end

  defp decrypt(<<@version_compressed_encrypted, _rest::binary>>, key)
       when is_nil(key) or byte_size(key) != 32 do
    {:error, :encryption_key_required}
  end

  defp decrypt(_data, _key) do
    {:error, :invalid_encrypted_format}
  end

  ## Compression

  defp decompress(data) do
    {:ok, :zlib.uncompress(data)}
  rescue
    _ -> {:error, :decompression_failed}
  end

  defp decompress_tagged(<<@version_compressed_only, compressed::binary>>) do
    decompress(compressed)
  end

  defp decompress_tagged(_) do
    {:error, :invalid_compressed_format}
  end

  defp tag_unencrypted(data, true = _compressed?) do
    <<@version_compressed_only, data::binary>>
  end

  defp tag_unencrypted(data, false = _compressed?) do
    data
  end

  ## Format Detection and Decoding

  defp decode_and_decrypt({:legacy, meta_body, data_body}, _key) do
    # Handle legacy disk adapter format (separate meta and data files)
    decode_legacy_disk_format(meta_body, data_body)
  end

  defp decode_and_decrypt(raw_data, key) do
    case detect_format(raw_data) do
      :legacy_json ->
        decode_json(raw_data)

      :compressed_encrypted ->
        with {:ok, compressed} <- decrypt(raw_data, key),
             {:ok, json} <- decompress(compressed) do
          decode_json(json)
        end

      :compressed_only ->
        with {:ok, json} <- decompress_tagged(raw_data) do
          decode_json(json)
        end

      :unknown ->
        {:error, :invalid_format}
    end
  end

  defp detect_format(<<@version_compressed_encrypted, _rest::binary>>), do: :compressed_encrypted
  defp detect_format(<<@version_compressed_only, _rest::binary>>), do: :compressed_only
  defp detect_format(<<"{", _rest::binary>>), do: :legacy_json
  defp detect_format(_), do: :unknown

  defp decode_legacy_disk_format(meta_body, data_body) do
    with {:ok, meta} <- Jason.decode(meta_body),
         {:ok, data} <- Jason.decode(data_body),
         {:ok, payload} <- normalize_legacy_payload(meta, data) do
      {:ok, payload}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_payload}
    end
  end

  defp normalize_legacy_payload(
         %{
           "doc_id" => doc_id,
           "created_at" => created_at,
           "last_updated_at" => last_updated_at,
           "version" => version
         } = meta,
         %{"history" => history}
       )
       when is_binary(doc_id) and is_integer(created_at) and is_integer(last_updated_at) and
              is_list(history) and is_integer(version) do
    case decode_history(history) do
      {:ok, decoded_history} ->
        {:ok,
         %{
           doc_id: doc_id,
           created_at: created_at,
           last_updated_at: last_updated_at,
           history: decoded_history,
           version: version,
           owner_email: Map.get(meta, "owner_email"),
           owner_sub: Map.get(meta, "owner_sub"),
           sharing_mode: parse_sharing_mode(Map.get(meta, "sharing_mode")),
           allowed_emails: Map.get(meta, "allowed_emails", [])
         }}

      error ->
        error
    end
  end

  defp normalize_legacy_payload(_, _), do: {:error, :invalid_payload}

  ## Serialization

  defp serialize_payload(payload) do
    %{
      "doc_id" => payload.doc_id,
      "created_at" => payload.created_at,
      "last_updated_at" => payload.last_updated_at,
      "history" => Enum.map(payload.history, &Base.encode64/1),
      "version" => payload.version,
      "owner_email" => Map.get(payload, :owner_email),
      "owner_sub" => Map.get(payload, :owner_sub),
      "sharing_mode" => serialize_sharing_mode(Map.get(payload, :sharing_mode)),
      "allowed_emails" => Map.get(payload, :allowed_emails, [])
    }
  end

  defp decode_json(json) when is_binary(json) do
    with {:ok, decoded} <- Jason.decode(json),
         {:ok, payload} <- normalize_payload(decoded) do
      {:ok, payload}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_payload}
    end
  end

  defp normalize_payload(%{
         "doc_id" => doc_id,
         "created_at" => created_at,
         "last_updated_at" => last_updated_at,
         "history" => history,
         "version" => version
       } = data)
       when is_binary(doc_id) and is_integer(created_at) and is_integer(last_updated_at) and
              is_list(history) and is_integer(version) do
    case decode_history(history) do
      {:ok, decoded_history} ->
        {:ok,
         %{
           doc_id: doc_id,
           created_at: created_at,
           last_updated_at: last_updated_at,
           history: decoded_history,
           version: version,
           owner_email: Map.get(data, "owner_email"),
           owner_sub: Map.get(data, "owner_sub"),
           sharing_mode: parse_sharing_mode(Map.get(data, "sharing_mode")),
           allowed_emails: Map.get(data, "allowed_emails", [])
         }}

      error ->
        error
    end
  end

  defp normalize_payload(_), do: {:error, :invalid_payload}

  defp decode_history(history) do
    result =
      Enum.reduce_while(history, {:ok, []}, fn item, {:ok, acc} ->
        case Base.decode64(item) do
          {:ok, binary} -> {:cont, {:ok, [binary | acc]}}
          :error -> {:halt, {:error, :invalid_history}}
        end
      end)

    case result do
      {:ok, list} -> {:ok, Enum.reverse(list)}
      error -> error
    end
  end

  defp serialize_sharing_mode(nil), do: nil
  defp serialize_sharing_mode(:only_me), do: "only_me"
  defp serialize_sharing_mode(:specific_people), do: "specific_people"
  defp serialize_sharing_mode(:authenticated_users), do: "authenticated_users"
  defp serialize_sharing_mode(:public), do: "public"
  defp serialize_sharing_mode(other), do: other

  defp parse_sharing_mode(nil), do: nil
  defp parse_sharing_mode("only_me"), do: :only_me
  defp parse_sharing_mode("specific_people"), do: :specific_people
  defp parse_sharing_mode("authenticated_users"), do: :authenticated_users
  defp parse_sharing_mode("public"), do: :public
  defp parse_sharing_mode(_), do: nil

  ## S3 Helpers

  defp object_key(doc_id, opts) do
    ensure_trailing_slash(Keyword.get(opts, :prefix, "documents/")) <> "#{doc_id}.enc"
  end

  defp legacy_object_key(doc_id, opts) do
    ensure_trailing_slash(Keyword.get(opts, :prefix, "documents/")) <> "#{doc_id}.json"
  end

  defp marker_prefix(opts) do
    ensure_trailing_slash(Keyword.get(opts, :prefix, "documents/")) <> "_created/"
  end

  defp marker_key(created_at, doc_id, opts) do
    marker_prefix(opts) <> pad_ts(created_at) <> "/" <> doc_id
  end

  defp pad_ts(ts) do
    ts |> Integer.to_string() |> String.pad_leading(13, "0")
  end

  defp ensure_trailing_slash(prefix) do
    if String.ends_with?(prefix, "/"), do: prefix, else: prefix <> "/"
  end

  ## General Helpers

  defp safe_delete(path) do
    case File.rm(path) do
      :ok -> :ok
      {:error, :enoent} -> :ok
      {:error, reason} -> {:error, reason}
    end
  end

  defp normalize_delete_result({:ok, _}), do: :ok
  defp normalize_delete_result({:error, {:http_error, 404, _}}), do: :ok
  defp normalize_delete_result({:error, reason}), do: {:error, reason}

  @doc """
  Decodes a Base64-encoded encryption key.

  Returns `{:ok, key}` if the key is valid (32 bytes after decoding),
  or `{:error, reason}` otherwise.
  """
  def decode_key(nil), do: {:ok, nil}

  def decode_key(base64_key) when is_binary(base64_key) do
    case Base.decode64(base64_key) do
      {:ok, key} when byte_size(key) == 32 ->
        {:ok, key}

      {:ok, key} ->
        {:error, {:invalid_key_size, byte_size(key)}}

      :error ->
        {:error, :invalid_base64}
    end
  end
end
