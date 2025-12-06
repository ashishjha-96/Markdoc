defmodule Markdoc.Storage do
  @moduledoc """
  Entry point for document persistence.

  Selects the configured adapter and exposes helper functions for load, persist,
  delete, and retention settings.
  """

  alias Markdoc.Storage.{DiskAdapter, S3Adapter, NoopAdapter}

  @type doc_id :: Markdoc.Storage.Adapter.doc_id()
  @type doc_payload :: Markdoc.Storage.Adapter.doc_payload()

  def backend, do: Keyword.get(config(), :backend, :none)

  def load(doc_id) do
    with {:ok, {mod, opts}} <- adapter_with_opts() do
      mod.load(doc_id, opts)
    end
  end

  def persist(%{doc_id: _} = payload) do
    with {:ok, {mod, opts}} <- adapter_with_opts() do
      mod.persist(payload, opts)
    end
  end

  def delete(doc_id) do
    with {:ok, {mod, opts}} <- adapter_with_opts() do
      mod.delete(doc_id, opts)
    end
  end

  def list_stale(cutoff_unix) do
    with {:ok, {mod, opts}} <- adapter_with_opts() do
      mod.list_stale(cutoff_unix, opts)
    end
  end

  def flush_interval_ms do
    Keyword.get(config(), :flush_interval_ms, 30_000)
  end

  def idle_flush_ms do
    Keyword.get(config(), :idle_flush_ms, 300_000)
  end

  def retention_seconds do
    hours = Keyword.get(config(), :retention_hours, 24)
    hours * 60 * 60
  end

  def cleanup_interval_ms do
    Keyword.get(config(), :cleanup_interval_ms, 900_000)
  end

  def disk_path do
    path = Keyword.get(config(), :disk_path, Path.expand("storage/documents"))
    Path.expand(path)
  end

  defp config, do: Application.get_env(:markdoc, :storage, [])

  defp adapter_with_opts do
    cfg = config()

    case Keyword.get(cfg, :backend, :none) do
      :none ->
        {:ok, {NoopAdapter, []}}

      :disk ->
        {:ok, {DiskAdapter, [path: disk_path()]}}

      :s3 ->
        bucket = Keyword.get(cfg, :s3_bucket)

        if is_nil(bucket) do
          {:error, :missing_bucket}
        else
          {:ok,
           {S3Adapter,
            [
              bucket: bucket,
              prefix: Keyword.get(cfg, :s3_prefix, "documents/")
            ]}}
        end
    end
  end
end
