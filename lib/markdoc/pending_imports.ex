defmodule Markdoc.PendingImports do
  @moduledoc """
  GenServer to temporarily store pending markdown imports.

  Used by the VSCode extension flow:
  1. Extension POSTs markdown to /api/import
  2. This GenServer stores it with a generated doc_id
  3. Extension opens browser to markdoc.live/{doc_id}?import=true
  4. Frontend fetches pending import via GET /api/import/:doc_id
  5. Import is consumed (one-time read) and auto-expires after 5 minutes
  """

  use GenServer
  require Logger

  @table_name :pending_imports
  @ttl_ms :timer.minutes(5)
  @cleanup_interval_ms :timer.minutes(1)
  @doc_id_length 8

  # Client API

  def start_link(_opts) do
    GenServer.start_link(__MODULE__, [], name: __MODULE__)
  end

  @doc """
  Store markdown content and return a generated doc_id.
  Returns {:ok, doc_id} on success.
  """
  @spec store(String.t()) :: {:ok, String.t()}
  def store(markdown) when is_binary(markdown) do
    doc_id = generate_doc_id()
    expires_at = System.monotonic_time(:millisecond) + @ttl_ms
    :ets.insert(@table_name, {doc_id, markdown, expires_at})

    Logger.info("Stored pending import",
      event: :pending_import_stored,
      doc_id: doc_id,
      size: byte_size(markdown)
    )

    {:ok, doc_id}
  end

  @doc """
  Fetch and delete a pending import (one-time read).
  Returns {:ok, markdown} if found, :not_found otherwise.
  """
  @spec fetch(String.t()) :: {:ok, String.t()} | :not_found
  def fetch(doc_id) when is_binary(doc_id) do
    case :ets.lookup(@table_name, doc_id) do
      [{^doc_id, markdown, expires_at}] ->
        now = System.monotonic_time(:millisecond)
        :ets.delete(@table_name, doc_id)

        if now < expires_at do
          Logger.info("Fetched pending import",
            event: :pending_import_fetched,
            doc_id: doc_id
          )
          {:ok, markdown}
        else
          Logger.info("Pending import expired",
            event: :pending_import_expired,
            doc_id: doc_id
          )
          :not_found
        end

      [] ->
        :not_found
    end
  end

  # Server Callbacks

  @impl true
  def init(_opts) do
    table = :ets.new(@table_name, [:set, :public, :named_table, read_concurrency: true])
    schedule_cleanup()
    {:ok, %{table: table}}
  end

  @impl true
  def handle_info(:cleanup, state) do
    cleanup_expired()
    schedule_cleanup()
    {:noreply, state}
  end

  # Private Functions

  defp generate_doc_id do
    @doc_id_length
    |> :crypto.strong_rand_bytes()
    |> Base.url_encode64(padding: false)
    |> binary_part(0, @doc_id_length)
  end

  defp schedule_cleanup do
    Process.send_after(self(), :cleanup, @cleanup_interval_ms)
  end

  defp cleanup_expired do
    now = System.monotonic_time(:millisecond)

    # Select and delete expired entries
    expired =
      :ets.select(@table_name, [
        {{:"$1", :_, :"$2"}, [{:<, :"$2", now}], [:"$1"]}
      ])

    Enum.each(expired, fn doc_id ->
      :ets.delete(@table_name, doc_id)
      Logger.debug("Cleaned up expired import",
        event: :pending_import_cleanup,
        doc_id: doc_id
      )
    end)

    if length(expired) > 0 do
      Logger.info("Cleaned up expired pending imports",
        event: :pending_imports_cleanup,
        count: length(expired)
      )
    end
  end
end
