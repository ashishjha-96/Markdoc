defmodule Markdoc.Storage.CleanupWorker do
  @moduledoc """
  Periodically prunes persisted documents beyond retention.
  """

  use GenServer
  require Logger

  alias Markdoc.{DocRegistry, Storage}

  ## Client API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  ## Server callbacks

  @impl true
  def init(_opts) do
    schedule_cleanup()
    {:ok, %{}}
  end

  @impl true
  def handle_info(:cleanup, state) do
    run_cleanup()
    schedule_cleanup()
    {:noreply, state}
  end

  ## Helpers

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, Storage.cleanup_interval_ms())
  end

  defp run_cleanup do
    cutoff = System.system_time(:second) - Storage.retention_seconds()

    stale_doc_ids =
      case Storage.list_stale(cutoff) do
        {:ok, ids} -> ids
        {:error, reason} ->
          Logger.warning("Failed to list stale documents",
            event: :list_stale_failed,
            reason: inspect(reason)
          )

          []
      end

    Enum.each(Enum.uniq(stale_doc_ids), &cleanup_doc/1)
  end

  defp cleanup_doc(doc_id) do
    case DocRegistry.lookup(doc_id) do
      [] ->
        case Storage.delete(doc_id) do
          :ok ->
            Logger.info("Deleted stale document",
              event: :document_cleanup,
              doc_id: doc_id
            )

          {:error, reason} ->
            Logger.warning("Failed to delete stale document",
              event: :document_cleanup_failed,
              doc_id: doc_id,
              reason: inspect(reason)
            )
        end

      _ ->
        Logger.debug("Skipping cleanup for active document",
          event: :document_cleanup_skipped,
          doc_id: doc_id
        )
    end
  end
end
