defmodule MarkdocWeb.Presence do
  @moduledoc """
  Provides presence tracking for collaborative editing.

  Tracks which users are currently connected to each document channel,
  along with their metadata (name, color, cursor position, etc.).

  Uses Phoenix.Presence which provides CRDT-based conflict resolution
  for presence state across distributed nodes.
  """

  use Phoenix.Presence,
    otp_app: :markdoc,
    pubsub_server: Markdoc.PubSub
end
