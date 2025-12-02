defmodule Markdoc.DocRegistry do
  @moduledoc """
  Registry for document processes.

  Provides a wrapper around Elixir's Registry to manage document server processes.
  Each document is identified by its unique doc_id string.
  """

  @doc """
  Returns a via tuple for registering or looking up a document process.

  ## Examples

      iex> Markdoc.DocRegistry.via_tuple("doc-123")
      {:via, Registry, {Markdoc.DocRegistry, "doc-123"}}
  """
  def via_tuple(doc_id) when is_binary(doc_id) do
    {:via, Registry, {__MODULE__, doc_id}}
  end

  @doc """
  Looks up a document process by doc_id.

  Returns a list of {pid, value} tuples, or [] if not found.
  """
  def lookup(doc_id) when is_binary(doc_id) do
    Registry.lookup(__MODULE__, doc_id)
  end

  @doc """
  Returns child spec for starting the registry under a supervisor.
  """
  def child_spec(_opts) do
    Registry.child_spec(
      keys: :unique,
      name: __MODULE__
    )
  end
end
