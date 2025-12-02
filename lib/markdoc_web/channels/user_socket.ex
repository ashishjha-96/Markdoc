defmodule MarkdocWeb.UserSocket do
  @moduledoc """
  WebSocket connection handler.

  Defines the channel routes and connection logic for the application.
  All document collaboration happens through the "doc:*" channel.
  """

  use Phoenix.Socket

  # Channel routes
  channel "doc:*", MarkdocWeb.DocChannel

  @impl true
  def connect(_params, socket, _connect_info) do
    # For now, accept all connections
    # In production, you would validate tokens here
    {:ok, socket}
  end

  @impl true
  def id(socket) do
    # Return a unique ID for this socket connection
    # This helps Phoenix Presence track reconnections properly
    # Using the socket's channel_pid as a unique identifier
    "socket:#{:erlang.phash2(socket.channel_pid || self())}"
  end
end
