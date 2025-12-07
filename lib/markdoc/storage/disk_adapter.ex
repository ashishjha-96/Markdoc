defmodule Markdoc.Storage.DiskAdapter do
  @moduledoc """
  Disk-backed storage adapter.

  Persists documents as JSON files under a configured directory.
  """

  @behaviour Markdoc.Storage.Adapter

  alias Markdoc.Storage.Adapter

  @impl Adapter
  def load(doc_id, opts) do
    data_path = data_path(doc_id, opts)
    meta_path = meta_path(doc_id, opts)

    with {:ok, meta_body} <- File.read(meta_path),
         {:ok, data_body} <- File.read(data_path),
         {:ok, meta} <- decode_meta(meta_body),
         {:ok, history} <- decode_history(data_body) do
      {:ok,
       %{
         doc_id: doc_id,
         created_at: meta.created_at,
         last_updated_at: meta.last_updated_at,
         history: history,
         version: meta.version
       }}
    else
      {:error, :enoent} -> :not_found
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_payload}
    end
  end

  @impl Adapter
  def persist(%{doc_id: doc_id} = payload, opts) do
    dir = Keyword.fetch!(opts, :path)
    File.mkdir_p!(dir)

    data_path = data_path(doc_id, opts)
    meta_path = meta_path(doc_id, opts)
    data_tmp = data_path <> ".tmp"
    meta_tmp = meta_path <> ".tmp"

    data_serialized = %{
      "history" => Enum.map(payload.history, &Base.encode64/1)
    }

    meta_serialized = %{
      "doc_id" => payload.doc_id,
      "created_at" => payload.created_at,
      "last_updated_at" => payload.last_updated_at,
      "version" => payload.version
    }

    # Write to temp files first, then atomically rename
    with {:ok, data_json} <- Jason.encode(data_serialized),
         {:ok, meta_json} <- Jason.encode(meta_serialized),
         :ok <- File.write(data_tmp, data_json),
         :ok <- File.write(meta_tmp, meta_json),
         :ok <- File.rename(data_tmp, data_path),
         :ok <- File.rename(meta_tmp, meta_path) do
      :ok
    else
      {:error, reason} ->
        # Clean up temp files on failure
        File.rm(data_tmp)
        File.rm(meta_tmp)
        {:error, reason}

      _ ->
        File.rm(data_tmp)
        File.rm(meta_tmp)
        {:error, :invalid_payload}
    end
  end

  @impl Adapter
  def delete(doc_id, opts) do
    data_path = data_path(doc_id, opts)
    meta_path = meta_path(doc_id, opts)

    data_result =
      case File.rm(data_path) do
        :ok -> :ok
        {:error, :enoent} -> :ok
        {:error, reason} -> {:error, reason}
      end

    meta_result =
      case File.rm(meta_path) do
        :ok -> :ok
        {:error, :enoent} -> :ok
        {:error, reason} -> {:error, reason}
      end

    case {data_result, meta_result} do
      {:ok, :ok} -> :ok
      {{:error, r}, _} -> {:error, r}
      {_, {:error, r}} -> {:error, r}
    end
  end

  @impl Adapter
  def list_stale(cutoff_unix, opts) do
    dir = Keyword.fetch!(opts, :path)

    with {:ok, entries} <- File.ls(dir) do
      docs =
        entries
        |> Enum.filter(&String.ends_with?(&1, ".meta.json"))
        |> Enum.reduce([], fn file, acc ->
          path = Path.join(dir, file)

          case File.read(path) do
            {:ok, body} ->
              case decode_meta(body) do
                {:ok, %{created_at: created_at, doc_id: doc_id}} when created_at <= cutoff_unix ->
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

  ## Helpers

  defp decode_meta(body) do
    with {:ok, decoded} <- Jason.decode(body),
         {:ok, meta} <- normalize_meta(decoded) do
      {:ok, meta}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_payload}
    end
  end

  defp decode_history(body) do
    with {:ok, decoded} <- Jason.decode(body),
         {:ok, history} <- normalize_history(decoded) do
      {:ok, history}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_payload}
    end
  end

  defp normalize_meta(%{
         "doc_id" => doc_id,
         "created_at" => created_at,
         "last_updated_at" => last_updated_at,
         "version" => version
       })
       when is_binary(doc_id) and is_integer(created_at) and is_integer(last_updated_at) and
              is_integer(version) do
    {:ok,
     %{
       doc_id: doc_id,
       created_at: created_at,
       last_updated_at: last_updated_at,
       version: version
     }}
  end

  defp normalize_meta(_), do: {:error, :invalid_payload}

  defp normalize_history(%{"history" => history}) when is_list(history) do
    decoded =
      Enum.reduce_while(history, {:ok, []}, fn item, {:ok, acc} ->
        case Base.decode64(item) do
          {:ok, binary} -> {:cont, {:ok, [binary | acc]}}
          :error -> {:halt, {:error, :invalid_payload}}
        end
      end)

    case decoded do
      {:ok, list} -> {:ok, Enum.reverse(list)}
      error -> error
    end
  end

  defp normalize_history(_), do: {:error, :invalid_payload}

  defp data_path(doc_id, opts) do
    dir = Keyword.fetch!(opts, :path)
    Path.join(dir, "#{doc_id}.json")
  end

  defp meta_path(doc_id, opts) do
    dir = Keyword.fetch!(opts, :path)
    Path.join(dir, "#{doc_id}.meta.json")
  end
end
