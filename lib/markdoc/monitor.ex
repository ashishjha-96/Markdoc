defmodule Markdoc.Monitor do
  @moduledoc """
  System monitoring GenServer that periodically logs metrics about:
  - Active document processes
  - Active WebSocket connections
  - Memory consumption

  Logs stats every 30 seconds to help track system resource usage.
  """

  use GenServer
  require Logger

  alias Markdoc.DocSupervisor

  # Log stats every 30 seconds
  @log_interval :timer.seconds(30)

  ## Client API

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  ## Server Callbacks

  @impl true
  def init(_opts) do
    # Schedule first stats log
    schedule_log()
    {:ok, %{}}
  end

  @impl true
  def handle_info(:log_stats, state) do
    log_system_stats()
    schedule_log()
    {:noreply, state}
  end

  ## Private Functions

  defp schedule_log do
    Process.send_after(self(), :log_stats, @log_interval)
  end

  defp log_system_stats do
    # Get active document count
    doc_count = DocSupervisor.count_documents()

    # Get total connection count across all documents
    connection_count = count_active_connections()

    # Get memory stats
    memory_stats = get_memory_stats()

    # Log the stats
    Logger.info("System stats",
      event: :system_stats,
      active_documents: doc_count,
      active_connections: connection_count,
      memory_total_mb: memory_stats.total_mb,
      memory_processes_mb: memory_stats.processes_mb,
      memory_binary_mb: memory_stats.binary_mb,
      memory_ets_mb: memory_stats.ets_mb,
      memory_atom_mb: memory_stats.atom_mb
    )
  end

  defp count_active_connections do
    # Get all active document PIDs
    doc_pids = DocSupervisor.list_documents()

    # For each document, get the user count from its state
    doc_pids
    |> Enum.map(fn pid ->
      try do
        # Get the GenServer state (users MapSet size)
        :sys.get_state(pid).users |> MapSet.size()
      catch
        # If process died between listing and querying
        :exit, _ -> 0
      end
    end)
    |> Enum.sum()
  end

  defp get_memory_stats do
    mem = :erlang.memory()

    %{
      total_mb: bytes_to_mb(mem[:total]),
      processes_mb: bytes_to_mb(mem[:processes]),
      binary_mb: bytes_to_mb(mem[:binary]),
      ets_mb: bytes_to_mb(mem[:ets]),
      atom_mb: bytes_to_mb(mem[:atom])
    }
  end

  defp bytes_to_mb(bytes) do
    Float.round(bytes / 1_024 / 1_024, 2)
  end
end
