defmodule Markdoc.DocServer do
  @moduledoc """
  GenServer managing in-memory document state.

  Each document is a separate process holding:
  - history: List of Y.js binary update blobs
  - users: Set of connected channel PIDs
  - update_count: Counter for triggering snapshots
  - cleanup_timer: Reference for idle timeout

  Lifecycle:
  1. Spawn on first user join
  2. Active while users connected
  3. Idle timeout (1 hour) when last user disconnects
  4. Terminate and garbage collect when timeout expires
  """

  use GenServer
  require Logger

  # Constants
  @snapshot_threshold 50
  @cleanup_timeout :timer.hours(1)

  # State structure
  defmodule State do
    @moduledoc false
    defstruct [
      :doc_id,
      :history,
      :users,
      :update_count,
      :cleanup_timer,
      :created_at,
      :last_updated_at,
      :last_flushed_at,
      :dirty?,
      :periodic_flush_timer,
      :idle_flush_timer,
      :storage_backend
    ]

    @type t :: %__MODULE__{
            doc_id: String.t(),
            history: [binary()],
            users: MapSet.t(pid()),
            update_count: non_neg_integer(),
            cleanup_timer: reference() | nil,
            created_at: non_neg_integer(),
            last_updated_at: non_neg_integer(),
            last_flushed_at: non_neg_integer() | nil,
            dirty?: boolean(),
            periodic_flush_timer: reference() | nil,
            idle_flush_timer: reference() | nil,
            storage_backend: atom()
          }
  end

  ## Client API

  @doc """
  Starts a new document server process.
  """
  def start_link(doc_id) when is_binary(doc_id) do
    GenServer.start_link(__MODULE__, doc_id, name: Markdoc.DocRegistry.via_tuple(doc_id))
  end

  @doc """
  Registers a channel PID as a user of this document.
  """
  def join(doc_id, channel_pid) when is_binary(doc_id) and is_pid(channel_pid) do
    GenServer.cast(Markdoc.DocRegistry.via_tuple(doc_id), {:join, channel_pid})
  end

  @doc """
  Unregisters a channel PID from this document.
  """
  def leave(doc_id, channel_pid) when is_binary(doc_id) and is_pid(channel_pid) do
    GenServer.cast(Markdoc.DocRegistry.via_tuple(doc_id), {:leave, channel_pid})
  end

  @doc """
  Adds a Y.js update binary to the document history.
  """
  def add_update(doc_id, binary) when is_binary(doc_id) and is_binary(binary) do
    GenServer.cast(Markdoc.DocRegistry.via_tuple(doc_id), {:add_update, binary})
  end

  @doc """
  Gets the full history of updates for this document.
  """
  def get_history(doc_id) when is_binary(doc_id) do
    GenServer.call(Markdoc.DocRegistry.via_tuple(doc_id), :get_history)
  end

  @doc """
  Saves a snapshot, replacing the entire history with a single merged update.
  """
  def save_snapshot(doc_id, snapshot_binary) when is_binary(doc_id) and is_binary(snapshot_binary) do
    GenServer.cast(Markdoc.DocRegistry.via_tuple(doc_id), {:save_snapshot, snapshot_binary})
  end

  ## Server Callbacks

  @impl true
  def init(doc_id) do
    Logger.metadata(doc_id: doc_id)
    Logger.info("Document spawned", event: :spawn, doc_id: doc_id)

    now = System.system_time(:second)
    storage_backend = Markdoc.Storage.backend()

    {history, created_at, last_updated_at} =
      case Markdoc.Storage.load(doc_id) do
        {:ok, payload} ->
          Logger.info("Loaded document from storage",
            event: :storage_load,
            doc_id: doc_id,
            backend: storage_backend
          )

          {payload.history, payload.created_at, payload.last_updated_at}

        :not_found ->
          {[], now, now}

        {:error, reason} ->
          Logger.warning("Failed to load document from storage",
            event: :storage_load_failed,
            doc_id: doc_id,
            reason: inspect(reason)
          )

          {[], now, now}
      end

    # Schedule periodic inactivity check
    Process.send_after(self(), :check_inactivity, @cleanup_timeout)

    {:ok,
     %State{
       doc_id: doc_id,
       history: history,
       users: MapSet.new(),
       update_count: 0,
       cleanup_timer: nil,
       created_at: created_at,
       last_updated_at: last_updated_at,
       last_flushed_at: nil,
       dirty?: false,
       periodic_flush_timer: schedule_periodic_flush(),
       idle_flush_timer: nil,
       storage_backend: storage_backend
     }}
  end

  @impl true
  def handle_cast({:join, channel_pid}, state) do
    # Monitor the channel process so we know when it dies
    Process.monitor(channel_pid)

    new_users = MapSet.put(state.users, channel_pid)
    new_state = %{state | users: new_users, cleanup_timer: nil}

    Logger.debug("User joined document",
      event: :user_joined,
      channel_pid: inspect(channel_pid),
      total_users: MapSet.size(new_users)
    )

    {:noreply, new_state}
  end

  @impl true
  def handle_cast({:leave, channel_pid}, state) do
    new_users = MapSet.delete(state.users, channel_pid)
    new_state = %{state | users: new_users}

    Logger.debug("User left document",
      event: :user_left,
      channel_pid: inspect(channel_pid),
      remaining_users: MapSet.size(new_users)
    )

    # Start cleanup timer if no users remain
    new_state =
      if MapSet.size(new_users) == 0 do
        timer_ref = Process.send_after(self(), :cleanup_timeout, @cleanup_timeout)
        Logger.info("Document is now idle",
          event: :document_idle,
          cleanup_timeout_ms: @cleanup_timeout
        )
        %{new_state | cleanup_timer: timer_ref}
      else
        new_state
      end

    {:noreply, new_state}
  end

  @impl true
  def handle_cast({:add_update, binary}, state) do
    new_history = [binary | state.history]
    new_count = state.update_count + 1
    now = System.system_time(:second)

    idle_flush_timer = reschedule_idle_flush(state.idle_flush_timer)

    Logger.debug("Document received update",
      event: :update_received,
      history_size: length(new_history),
      update_count: new_count
    )

    # Check if we need to trigger a snapshot
    new_state =
      if new_count >= @snapshot_threshold do
        Logger.info("Document reached snapshot threshold",
          event: :snapshot_threshold_reached,
          threshold: @snapshot_threshold,
          update_count: new_count
        )

        trigger_snapshot_request(state.users, state.doc_id)

        %{
          state
          | history: new_history,
            update_count: 0,
            dirty?: true,
            last_updated_at: now,
            idle_flush_timer: idle_flush_timer
        }
      else
        %{
          state
          | history: new_history,
            update_count: new_count,
            dirty?: true,
            last_updated_at: now,
            idle_flush_timer: idle_flush_timer
        }
      end

    {:noreply, new_state}
  end

  @impl true
  def handle_cast({:save_snapshot, snapshot_binary}, state) do
    old_count = length(state.history)
    now = System.system_time(:second)
    idle_flush_timer = reschedule_idle_flush(state.idle_flush_timer)

    Logger.info("Snapshot saved",
      event: :snapshot_saved,
      old_update_count: old_count,
      new_update_count: 1
    )

    # Replace entire history with single snapshot blob
    {:noreply,
     %{
       state
       | history: [snapshot_binary],
         update_count: 0,
         dirty?: true,
         last_updated_at: now,
         idle_flush_timer: idle_flush_timer
     }}
  end

  @impl true
  def handle_call(:get_history, _from, state) do
    {:reply, state.history, state}
  end

  @impl true
  def handle_info(:check_inactivity, state) do
    # Periodic check for inactivity
    if MapSet.size(state.users) == 0 do
      Logger.info("Document idle timeout, terminating",
        event: :idle_timeout,
        reason: :no_users
      )
      {:stop, :normal, state}
    else
      # Reschedule check
      Process.send_after(self(), :check_inactivity, @cleanup_timeout)
      {:noreply, state}
    end
  end

  @impl true
  def handle_info(:cleanup_timeout, state) do
    Logger.info("Document cleanup timeout expired, terminating",
      event: :cleanup_timeout,
      reason: :timeout_expired
    )
    {:stop, :normal, state}
  end

  @impl true
  def handle_info(:periodic_flush, state) do
    new_state = maybe_flush(state, :periodic)
    {:noreply, %{new_state | periodic_flush_timer: schedule_periodic_flush()}}
  end

  @impl true
  def handle_info(:idle_flush, state) do
    new_state = maybe_flush(state, :idle)
    {:noreply, %{new_state | idle_flush_timer: nil}}
  end

  @impl true
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    # A monitored channel process died
    new_users = MapSet.delete(state.users, pid)

    Logger.debug("Monitored process died",
      event: :process_died,
      channel_pid: inspect(pid),
      remaining_users: MapSet.size(new_users)
    )

    # Start cleanup timer if no users remain
    new_state =
      if MapSet.size(new_users) == 0 do
        timer_ref = Process.send_after(self(), :cleanup_timeout, @cleanup_timeout)
        Logger.info("Document is now idle",
          event: :document_idle,
          cleanup_timeout_ms: @cleanup_timeout
        )
        %{state | users: new_users, cleanup_timer: timer_ref}
      else
        %{state | users: new_users}
      end

    {:noreply, new_state}
  end

  @impl true
  def terminate(reason, state) do
    maybe_flush(state, :terminate)

    Logger.info("Document terminated",
      event: :terminate,
      reason: inspect(reason)
    )

    :ok
  end

  ## Private Functions

  defp maybe_flush(state, reason) do
    if state.dirty? do
      payload = %{
        doc_id: state.doc_id,
        created_at: state.created_at,
        last_updated_at: state.last_updated_at,
        history: state.history,
        version: 1
      }

      case Markdoc.Storage.persist(payload) do
        :ok ->
          Logger.info("Flushed document to storage",
            event: :storage_flush,
            doc_id: state.doc_id,
            reason: reason,
            history_size: length(state.history)
          )

          %{state | dirty?: false, last_flushed_at: System.system_time(:second)}

        {:error, flush_reason} ->
          Logger.warning("Failed to flush document to storage",
            event: :storage_flush_failed,
            doc_id: state.doc_id,
            reason: inspect(flush_reason)
          )

          state
      end
    else
      state
    end
  end

  defp schedule_periodic_flush do
    Process.send_after(self(), :periodic_flush, Markdoc.Storage.flush_interval_ms())
  end

  defp reschedule_idle_flush(nil) do
    Process.send_after(self(), :idle_flush, Markdoc.Storage.idle_flush_ms())
  end

  defp reschedule_idle_flush(timer_ref) do
    Process.cancel_timer(timer_ref)
    Process.send_after(self(), :idle_flush, Markdoc.Storage.idle_flush_ms())
  end

  defp trigger_snapshot_request(users, doc_id) do
    case users |> MapSet.to_list() |> Enum.take_random(1) do
      [pid] ->
        Logger.debug("Requesting snapshot from channel",
          event: :snapshot_request,
          channel_pid: inspect(pid),
          doc_id: doc_id
        )
        send(pid, :request_snapshot)

      [] ->
        Logger.warning("Cannot request snapshot, no users connected",
          event: :snapshot_request_failed,
          reason: :no_users,
          doc_id: doc_id
        )
        :ok
    end
  end
end
