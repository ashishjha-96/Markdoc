defmodule MarkdocWeb.DocChannel do
  @moduledoc """
  Phoenix Channel for document collaboration.

  Handles WebSocket connections for "doc:*" topics. Each document gets its own
  topic (e.g., "doc:meeting-notes") where users can collaborate in real-time.

  ## Message Protocol

  ### Client → Server
  - "client_update" %{bin: [1,2,3...]} - Y.js update from client
  - "snapshot" %{body: [1,2,3...]} - Compressed snapshot from client
  - "cursor_move" %{position: %{...}} - Cursor position update

  ### Server → Client
  - "server_update" %{bin: [1,2,3...]} - Broadcast update to other clients
  - "request_snapshot" %{} - Request client to compress document
  - "presence_state" %{...} - Initial presence state
  - "presence_diff" %{...} - Presence changes
  """

  use MarkdocWeb, :channel
  require Logger

  alias Markdoc.{DocServer, DocSupervisor, DocRegistry}
  alias MarkdocWeb.Presence

  @impl true
  def join("doc:" <> doc_id, params, socket) do
    Logger.info("Client joining document: #{doc_id}")

    # Ensure document process exists
    case DocRegistry.lookup(doc_id) do
      [] ->
        Logger.info("Document #{doc_id} not found, starting new process")

        case DocSupervisor.start_doc(doc_id) do
          {:ok, _pid} -> :ok
          {:error, {:already_started, _pid}} -> :ok
        end

      [{_pid, _}] ->
        Logger.debug("Document #{doc_id} already exists")
        :ok
    end

    # Register this channel with the document server
    DocServer.join(doc_id, self())

    # Fetch history
    history = DocServer.get_history(doc_id)

    Logger.debug("Document #{doc_id} has #{length(history)} updates in history")

    # Convert binary history to arrays for JSON transport
    history_arrays = Enum.map(history, &:erlang.binary_to_list/1)

    # Assign doc_id to socket for later use
    socket = assign(socket, :doc_id, doc_id)

    # Generate a unique user_id for this connection
    user_id = "user_#{:erlang.phash2(self())}"
    socket = assign(socket, :user_id, user_id)

    # Extract user info from params (sent by client)
    user_info = params["user"] || %{}
    user_name = user_info["name"] || "Anonymous"
    user_color = user_info["color"] || generate_random_color()

    socket = assign(socket, :user_name, user_name)
    socket = assign(socket, :user_color, user_color)

    Logger.info("User '#{user_name}' joining document #{doc_id}")

    # Track presence after join (send message to self)
    send(self(), :after_join)

    {:ok, %{history: history_arrays}, socket}
  end

  @impl true
  def handle_in("client_update", %{"bin" => binary_array}, socket) when is_list(binary_array) do
    doc_id = socket.assigns.doc_id

    # Convert JSON array to binary
    binary = :erlang.list_to_binary(binary_array)

    # Save to GenServer
    DocServer.add_update(doc_id, binary)

    # Broadcast to all other clients (excluding sender)
    broadcast_from!(socket, "server_update", %{"bin" => binary_array})

    {:noreply, socket}
  end

  @impl true
  def handle_in("snapshot", %{"body" => binary_array}, socket) when is_list(binary_array) do
    doc_id = socket.assigns.doc_id

    # Convert JSON array to binary
    binary = :erlang.list_to_binary(binary_array)

    Logger.info("Received snapshot for document #{doc_id}, size: #{byte_size(binary)} bytes")

    # Save snapshot to GenServer
    DocServer.save_snapshot(doc_id, binary)

    {:reply, :ok, socket}
  end

  @impl true
  def handle_in("cursor_move", %{"position" => position}, socket) do
    user_id = socket.assigns.user_id
    user_name = socket.assigns.user_name
    user_color = socket.assigns.user_color

    # Broadcast cursor position directly (without using Presence)
    # This avoids triggering presence_diff events for every cursor move
    broadcast_from!(socket, "cursor_update", %{
      user_id: user_id,
      user_name: user_name,
      user_color: user_color,
      position: position
    })

    {:noreply, socket}
  end

  @impl true
  def handle_info(:after_join, socket) do
    user_id = socket.assigns.user_id
    user_name = socket.assigns.user_name
    user_color = socket.assigns.user_color

    # Track user presence (without cursor - cursors are broadcast separately)
    {:ok, _} =
      Presence.track(socket, user_id, %{
        name: user_name,
        color: user_color,
        online_at: System.system_time(:second)
      })

    # Push current presence state to the client
    push(socket, "presence_state", Presence.list(socket))

    {:noreply, socket}
  end

  @impl true
  def handle_info(:request_snapshot, socket) do
    Logger.debug("Requesting snapshot from client for document #{socket.assigns.doc_id}")

    # Forward snapshot request to client
    push(socket, "request_snapshot", %{})

    {:noreply, socket}
  end

  @impl true
  def terminate(reason, socket) do
    doc_id = socket.assigns[:doc_id]

    if doc_id do
      Logger.info("Client leaving document: #{doc_id}, reason: #{inspect(reason)}")
      DocServer.leave(doc_id, self())
    end

    :ok
  end

  ## Private Functions

  defp generate_random_color do
    # Generate a random hex color
    "#" <>
      (for _ <- 1..3, into: "", do: :rand.uniform(256) - 1 |> Integer.to_string(16) |> String.pad_leading(2, "0"))
  end
end
