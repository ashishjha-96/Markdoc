defmodule Markdoc.Storage.S3Adapter do
  @moduledoc """
  S3-compatible storage adapter using ExAws.
  """

  @behaviour Markdoc.Storage.Adapter

  alias Markdoc.Storage.Adapter

  @impl Adapter
  def load(doc_id, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    data_key = object_key(doc_id, opts)

    case ExAws.S3.get_object(bucket, data_key) |> ExAws.request() do
      {:ok, %{body: body}} ->
        decode_payload(body)

      {:error, {:http_error, 404, _}} ->
        :not_found

      {:error, reason} ->
        {:error, reason}
    end
  end

  @impl Adapter
  def persist(%{doc_id: doc_id} = payload, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    data_key = object_key(doc_id, opts)
    marker_key = marker_key(payload.created_at, doc_id, opts)

    serialized = %{
      "doc_id" => payload.doc_id,
      "created_at" => payload.created_at,
      "last_updated_at" => payload.last_updated_at,
      "history" => Enum.map(payload.history, &:erlang.binary_to_list/1),
      "version" => payload.version
    }

    with {:ok, data_body} <- Jason.encode(serialized),
         {:ok, _} <-
           ExAws.S3.put_object(bucket, data_key, data_body,
             content_type: "application/json",
             metadata: %{"created-at" => Integer.to_string(payload.created_at)}
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
      _ -> {:error, :invalid_payload}
    end
  end

  @impl Adapter
  def delete(doc_id, opts) do
    bucket = Keyword.fetch!(opts, :bucket)
    data_key = object_key(doc_id, opts)
    marker_prefix = marker_prefix(opts)

    data_result =
      ExAws.S3.delete_object(bucket, data_key)
      |> ExAws.request()
      |> normalize_delete_result()

    marker_result =
      ExAws.S3.list_objects_v2(bucket, prefix: marker_prefix)
      |> ExAws.stream!()
      |> Stream.filter(fn %{key: k} -> String.ends_with?(k, "/#{doc_id}") end)
      |> Enum.map(fn %{key: k} ->
        ExAws.S3.delete_object(bucket, k) |> ExAws.request() |> normalize_delete_result()
      end)
      |> Enum.find(:ok, fn
        :ok -> false
        _ -> true
      end)

    case {data_result, marker_result} do
      {:ok, :ok} -> :ok
      {err = {:error, _}, _} -> err
      {_, err = {:error, _}} -> err
    end
  end

  @impl Adapter
  def list_stale(cutoff_unix, opts) do
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
              ts_str <= cutoff_str ->
                {[doc_id | acc], acc}

              ts_str > cutoff_str ->
                {:halt, acc}

              true ->
                {[], acc}
            end

          _ ->
            {[], acc}
        end
      end)
      |> Enum.to_list()
      |> Enum.uniq()

    {:ok, stale_ids}
  rescue
    e ->
      {:error, e}
  end

  ## Helpers

  defp decode_payload(body) do
    with {:ok, decoded} <- Jason.decode(body),
         {:ok, payload} <- normalize(decoded) do
      {:ok, payload}
    else
      {:error, reason} -> {:error, reason}
      _ -> {:error, :invalid_payload}
    end
  end

  defp normalize(%{
         "doc_id" => doc_id,
         "created_at" => created_at,
         "last_updated_at" => last_updated_at,
         "history" => history,
         "version" => version
       })
       when is_binary(doc_id) and is_integer(created_at) and is_integer(last_updated_at) and
              is_list(history) and is_integer(version) do
    {:ok,
     %{
       doc_id: doc_id,
       created_at: created_at,
       last_updated_at: last_updated_at,
       history: Enum.map(history, &:erlang.list_to_binary/1),
       version: version
     }}
  end

  defp normalize(_), do: {:error, :invalid_payload}

  defp object_key(doc_id, opts) do
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

  defp normalize_delete_result({:ok, _}), do: :ok
  defp normalize_delete_result({:error, {:http_error, 404, _}}), do: :ok
  defp normalize_delete_result({:error, reason}), do: {:error, reason}

  defp ensure_trailing_slash(prefix) do
    if String.ends_with?(prefix, "/"), do: prefix, else: prefix <> "/"
  end
end
