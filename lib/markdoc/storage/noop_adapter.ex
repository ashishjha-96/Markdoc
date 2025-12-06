defmodule Markdoc.Storage.NoopAdapter do
  @moduledoc """
  No-op storage adapter for in-memory-only behavior.
  """

  @behaviour Markdoc.Storage.Adapter

  @impl true
  def load(_doc_id, _opts), do: :not_found

  @impl true
  def persist(_payload, _opts), do: :ok

  @impl true
  def delete(_doc_id, _opts), do: :ok

  @impl true
  def list_stale(_cutoff_unix, _opts), do: {:ok, []}
end
