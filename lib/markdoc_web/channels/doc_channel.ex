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

  ## Authorization

  Documents on the private domain require authentication and respect sharing settings:
  - :public - Anyone can access
  - :authenticated_users - Any authenticated user can access
  - :specific_people - Only owner and listed emails can access
  - :only_me - Only the owner can access
  """

  use MarkdocWeb, :channel
  require Logger

  alias Markdoc.{DocServer, DocSupervisor, DocRegistry}
  alias MarkdocWeb.Presence

  # Valid doc ID pattern: 21 characters, URL-safe (A-Za-z0-9_-)
  @doc_id_pattern ~r/^[A-Za-z0-9_-]{21}$/

  @impl true
  def join("doc:" <> doc_id, params, socket) do
    Logger.metadata(doc_id: doc_id)
    Logger.info("Client joining document", event: :client_join, doc_id: doc_id)

    # Validate doc ID format first
    unless valid_doc_id?(doc_id) do
      Logger.warning("Invalid document ID format",
        event: :invalid_doc_id,
        doc_id: doc_id
      )
      {:error, %{reason: "invalid_doc_id"}}
    else
      auth_user = socket.assigns[:auth_user] || %{authenticated: false, domain: :public}

      # Ensure document process exists
      ensure_doc_exists(doc_id)

      # Get document metadata for authorization
      metadata = DocServer.get_metadata(doc_id)

      # Check authorization
      case authorize(auth_user, metadata) do
        :ok ->
          # Set owner if new private doc
          if is_nil(metadata.owner_email) and auth_user.domain == :private and auth_user.authenticated do
            DocServer.set_owner(doc_id, auth_user.email, auth_user.sub)
          end

          # Register this channel with the document server
          DocServer.join(doc_id, self())

          # Fetch history
          history = DocServer.get_history(doc_id)

          Logger.debug("Document history fetched",
            event: :history_fetched,
            history_size: length(history)
          )

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

        # Check if user is the owner
        is_owner = auth_user.email != nil and auth_user.email == metadata.owner_email

        Logger.info("User joining document",
          event: :user_join,
          user_name: user_name,
          user_color: user_color,
          is_owner: is_owner
        )

        # Track presence after join (send message to self)
        send(self(), :after_join)

        {:ok, %{
          history: history_arrays,
          is_owner: is_owner,
          sharing_mode: metadata.sharing_mode,
          is_private_domain: auth_user.domain == :private
        }, socket}

      {:error, reason} ->
        Logger.warning("Authorization denied for document",
          event: :auth_denied,
          reason: reason,
          user_email: auth_user[:email]
        )
        {:error, %{reason: reason}}
      end
    end
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

    Logger.info("Received snapshot from client",
      event: :snapshot_received,
      size_bytes: byte_size(binary)
    )

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
  def handle_in("chat_typing", %{"chat_id" => chat_id, "is_typing" => is_typing}, socket) do
    user_id = socket.assigns.user_id
    user_name = socket.assigns.user_name

    # Broadcast typing status (ephemeral, no persistence)
    broadcast_from!(socket, "chat_typing", %{
      chat_id: chat_id,
      user_id: user_id,
      user_name: user_name,
      is_typing: is_typing
    })

    {:noreply, socket}
  end

  @impl true
  def handle_in("chat_read", %{"chat_id" => chat_id, "message_id" => message_id}, socket) do
    user_id = socket.assigns.user_id

    # Broadcast read receipt (ephemeral, no persistence)
    broadcast_from!(socket, "chat_read", %{
      chat_id: chat_id,
      user_id: user_id,
      last_read_message_id: message_id,
      timestamp: System.system_time(:millisecond)
    })

    {:noreply, socket}
  end

  @impl true
  def handle_in("purge", _params, socket) do
    doc_id = socket.assigns.doc_id
    auth_user = socket.assigns[:auth_user] || %{authenticated: false, email: nil}

    Logger.info("Purge request received",
      event: :purge_request,
      doc_id: doc_id,
      requester: auth_user[:email]
    )

    case DocServer.purge(doc_id, auth_user[:email]) do
      :ok ->
        # Broadcast to all clients that the document was purged
        broadcast!(socket, "document_purged", %{})

        Logger.info("Document purged successfully",
          event: :document_purged,
          doc_id: doc_id
        )

        {:reply, {:ok, %{status: "purged"}}, socket}

      {:error, :unauthorized} ->
        Logger.warning("Unauthorized purge attempt",
          event: :purge_unauthorized,
          doc_id: doc_id,
          requester: auth_user[:email]
        )
        {:reply, {:error, %{reason: "unauthorized"}}, socket}

      {:error, reason} ->
        Logger.error("Purge failed",
          event: :purge_failed,
          doc_id: doc_id,
          reason: inspect(reason)
        )
        {:reply, {:error, %{reason: "failed"}}, socket}
    end
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
    Logger.debug("Requesting snapshot from client",
      event: :snapshot_request_to_client
    )

    # Forward snapshot request to client
    push(socket, "request_snapshot", %{})

    {:noreply, socket}
  end

  @impl true
  def terminate(reason, socket) do
    doc_id = socket.assigns[:doc_id]

    if doc_id do
      Logger.info("Client leaving document",
        event: :client_leave,
        doc_id: doc_id,
        reason: inspect(reason)
      )
      DocServer.leave(doc_id, self())
    end

    :ok
  end

  ## Private Functions

  defp ensure_doc_exists(doc_id) do
    case DocRegistry.lookup(doc_id) do
      [] ->
        Logger.info("Document not found, starting new process",
          event: :document_start,
          reason: :not_found
        )

        case DocSupervisor.start_doc(doc_id) do
          {:ok, _pid} -> :ok
          {:error, {:already_started, _pid}} -> :ok
        end

      [{_pid, _}] ->
        Logger.debug("Document already exists", event: :document_exists)
        :ok
    end
  end

  defp authorize(auth_user, metadata) do
    cond do
      # Public documents are accessible to everyone
      metadata.sharing_mode == :public ->
        :ok

      # Legacy documents without sharing mode are treated as public
      is_nil(metadata.sharing_mode) and is_nil(metadata.owner_email) ->
        :ok

      # Document owner always has access
      auth_user[:email] != nil and metadata.owner_email == auth_user[:email] ->
        :ok

      # Authenticated users mode - any authenticated user can access
      metadata.sharing_mode == :authenticated_users and auth_user[:authenticated] == true ->
        :ok

      # Specific people mode - check if user's email is in allowed list
      metadata.sharing_mode == :specific_people and auth_user[:email] in (metadata.allowed_emails || []) ->
        :ok

      # Only me mode - only owner (handled above)
      metadata.sharing_mode == :only_me ->
        {:error, "unauthorized"}

      # Public domain accessing a private document without proper permissions
      auth_user[:domain] == :public and metadata.owner_email != nil ->
        {:error, "unauthorized"}

      # Default deny
      true ->
        {:error, "unauthorized"}
    end
  end

  defp generate_random_color do
    "#" <> (3 |> :crypto.strong_rand_bytes() |> Base.encode16(case: :lower))
  end

  defp valid_doc_id?(doc_id) when is_binary(doc_id) do
    Regex.match?(@doc_id_pattern, doc_id)
  end

  defp valid_doc_id?(_), do: false
end
