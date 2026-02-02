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
      :storage_backend,
      # Sharing/ownership fields
      :owner_email,
      :owner_sub,
      :sharing_mode,
      :allowed_emails
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
            storage_backend: atom(),
            owner_email: String.t() | nil,
            owner_sub: String.t() | nil,
            sharing_mode: :only_me | :specific_people | :authenticated_users | :public | nil,
            allowed_emails: [String.t()]
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

  @doc """
  Forces a flush to the configured storage backend.
  """
  def flush(doc_id) when is_binary(doc_id) do
    GenServer.call(Markdoc.DocRegistry.via_tuple(doc_id), :flush)
  end

  @doc """
  Gets the metadata (ownership/sharing info) for this document.
  """
  def get_metadata(doc_id) when is_binary(doc_id) do
    GenServer.call(Markdoc.DocRegistry.via_tuple(doc_id), :get_metadata)
  end

  @doc """
  Sets the owner of a document (only if not already set).
  """
  def set_owner(doc_id, email, sub) when is_binary(doc_id) do
    GenServer.call(Markdoc.DocRegistry.via_tuple(doc_id), {:set_owner, email, sub})
  end

  @doc """
  Updates sharing settings for a document.
  Only the owner can update sharing settings.
  """
  def update_sharing(doc_id, owner_email, sharing_settings) when is_binary(doc_id) do
    GenServer.call(Markdoc.DocRegistry.via_tuple(doc_id), {:update_sharing, owner_email, sharing_settings})
  end

  @doc """
  Purges a document completely - deletes from storage and terminates the process.
  Only the owner can purge a document.
  Returns :ok on success, {:error, reason} on failure.
  """
  def purge(doc_id, requester_email) when is_binary(doc_id) do
    GenServer.call(Markdoc.DocRegistry.via_tuple(doc_id), {:purge, requester_email})
  end

  ## Server Callbacks

  @impl true
  def init(doc_id) do
    Logger.metadata(doc_id: doc_id)
    Logger.info("Document spawned", event: :spawn, doc_id: doc_id)

    now = System.system_time(:second)
    storage_backend = Markdoc.Storage.backend()

    {history, created_at, last_updated_at, owner_email, owner_sub, sharing_mode, allowed_emails} =
      case Markdoc.Storage.load(doc_id) do
        {:ok, payload} ->
          Logger.info("Loaded document from storage",
            event: :storage_load,
            doc_id: doc_id,
            backend: storage_backend
          )

          {
            payload.history,
            payload.created_at,
            payload.last_updated_at,
            Map.get(payload, :owner_email),
            Map.get(payload, :owner_sub),
            Map.get(payload, :sharing_mode),
            Map.get(payload, :allowed_emails, [])
          }

        :not_found ->
          {[], now, now, nil, nil, nil, []}

        {:error, reason} ->
          Logger.warning("Failed to load document from storage",
            event: :storage_load_failed,
            doc_id: doc_id,
            reason: inspect(reason)
          )

          {[], now, now, nil, nil, nil, []}
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
       storage_backend: storage_backend,
       owner_email: owner_email,
       owner_sub: owner_sub,
       sharing_mode: sharing_mode,
       allowed_emails: allowed_emails
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
    base_state = %{state | users: new_users, idle_flush_timer: cancel_timer(state.idle_flush_timer)}

    Logger.debug("User left document",
      event: :user_left,
      channel_pid: inspect(channel_pid),
      remaining_users: MapSet.size(new_users)
    )

    # Start cleanup timer if no users remain
    new_state =
      if MapSet.size(new_users) == 0 do
        flushed_state = maybe_flush(base_state, :idle_flush)
        timer_ref = Process.send_after(self(), :cleanup_timeout, @cleanup_timeout)

        Logger.info("Document is now idle",
          event: :document_idle,
          cleanup_timeout_ms: @cleanup_timeout
        )

        %{flushed_state | cleanup_timer: timer_ref}
      else
        base_state
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
  def handle_call(:flush, _from, state) do
    new_state = maybe_flush(state, :manual)
    {:reply, :ok, new_state}
  end

  @impl true
  def handle_call(:get_metadata, _from, state) do
    metadata = %{
      owner_email: state.owner_email,
      owner_sub: state.owner_sub,
      sharing_mode: state.sharing_mode,
      allowed_emails: state.allowed_emails,
      created_at: state.created_at,
      last_updated_at: state.last_updated_at
    }
    {:reply, metadata, state}
  end

  @impl true
  def handle_call({:set_owner, email, sub}, _from, state) do
    if is_nil(state.owner_email) do
      Logger.info("Setting document owner",
        event: :owner_set,
        owner_email: email
      )

      new_state = %{
        state
        | owner_email: email,
          owner_sub: sub,
          sharing_mode: :only_me,
          dirty?: true
      }

      {:reply, :ok, new_state}
    else
      {:reply, {:error, :owner_already_set}, state}
    end
  end

  @impl true
  def handle_call({:update_sharing, requester_email, settings}, _from, state) do
    cond do
      is_nil(state.owner_email) ->
        {:reply, {:error, :no_owner}, state}

      state.owner_email != requester_email ->
        Logger.warning("Unauthorized sharing update attempt",
          event: :unauthorized_sharing_update,
          requester: requester_email,
          owner: state.owner_email
        )
        {:reply, {:error, :unauthorized}, state}

      true ->
        sharing_mode = Map.get(settings, :sharing_mode, state.sharing_mode)
        allowed_emails = Map.get(settings, :allowed_emails, state.allowed_emails)

        # Validate allowed_emails list size (max 50)
        allowed_emails = Enum.take(allowed_emails, 50)

        # Validate email format
        allowed_emails = Enum.filter(allowed_emails, &valid_email?/1)

        Logger.info("Updating sharing settings",
          event: :sharing_updated,
          sharing_mode: sharing_mode,
          allowed_emails_count: length(allowed_emails)
        )

        new_state = %{
          state
          | sharing_mode: sharing_mode,
            allowed_emails: allowed_emails,
            dirty?: true
        }

        # Notify all connected channels to re-evaluate access
        metadata = %{
          owner_email: state.owner_email,
          sharing_mode: sharing_mode,
          allowed_emails: allowed_emails
        }
        notify_sharing_changed(state.users, metadata)

        {:reply, :ok, new_state}
    end
  end

  @impl true
  def handle_call({:purge, requester_email}, _from, state) do
    cond do
      # Allow purging documents without owner (public documents)
      is_nil(state.owner_email) ->
        do_purge(state)

      # Only owner can purge owned documents
      state.owner_email == requester_email ->
        do_purge(state)

      true ->
        Logger.warning("Unauthorized purge attempt",
          event: :unauthorized_purge,
          requester: requester_email,
          owner: state.owner_email
        )
        {:reply, {:error, :unauthorized}, state}
    end
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
        base_state = %{state | users: new_users, idle_flush_timer: cancel_timer(state.idle_flush_timer)}
        flushed_state = maybe_flush(base_state, :idle_flush)
        timer_ref = Process.send_after(self(), :cleanup_timeout, @cleanup_timeout)

        Logger.info("Document is now idle",
          event: :document_idle,
          cleanup_timeout_ms: @cleanup_timeout
        )

        %{flushed_state | cleanup_timer: timer_ref}
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
        version: 1,
        owner_email: state.owner_email,
        owner_sub: state.owner_sub,
        sharing_mode: state.sharing_mode,
        allowed_emails: state.allowed_emails
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

  defp cancel_timer(nil), do: nil
  defp cancel_timer(ref) do
    Process.cancel_timer(ref)
    nil
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

  defp valid_email?(email) when is_binary(email) do
    # Basic email validation - must contain @ and have content before and after
    case String.split(email, "@") do
      [local, domain] when byte_size(local) > 0 and byte_size(domain) > 2 ->
        String.contains?(domain, ".")
      _ ->
        false
    end
  end

  defp valid_email?(_), do: false

  defp notify_sharing_changed(users, metadata) do
    # Send sharing_changed message to all connected channels
    Enum.each(users, fn pid ->
      send(pid, {:sharing_changed, metadata})
    end)
  end

  defp do_purge(state) do
    Logger.info("Purging document",
      event: :document_purge,
      doc_id: state.doc_id
    )

    # Delete from storage
    case Markdoc.Storage.delete(state.doc_id) do
      :ok ->
        Logger.info("Document purged from storage",
          event: :document_purged,
          doc_id: state.doc_id
        )
        # Stop the GenServer after successful deletion
        {:stop, :normal, :ok, state}

      {:error, reason} ->
        Logger.error("Failed to purge document from storage",
          event: :purge_failed,
          doc_id: state.doc_id,
          reason: inspect(reason)
        )
        {:reply, {:error, :storage_error}, state}
    end
  end
end
