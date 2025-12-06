defmodule Markdoc.Storage.Adapter do
  @moduledoc """
  Behaviour for persistence adapters.

  Implementations must handle loading, persisting, deleting documents, and
  optionally listing stale entries for retention cleanup.
  """

  @type doc_id :: String.t()
  @type doc_payload :: %{
          doc_id: doc_id(),
          created_at: non_neg_integer(),
          last_updated_at: non_neg_integer(),
          history: [binary()],
          version: pos_integer()
        }

  @callback load(doc_id(), keyword()) ::
              {:ok, doc_payload()} | :not_found | {:error, term()}

  @callback persist(doc_payload(), keyword()) :: :ok | {:error, term()}

  @callback delete(doc_id(), keyword()) :: :ok | {:error, term()}

  @callback list_stale(non_neg_integer(), keyword()) ::
              {:ok, [doc_id()]} | {:error, term()}
end
