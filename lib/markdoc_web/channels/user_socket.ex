defmodule MarkdocWeb.UserSocket do
  @moduledoc """
  WebSocket connection handler.

  Defines the channel routes and connection logic for the application.
  All document collaboration happens through the "doc:*" channel.

  Handles Cloudflare Zero Trust authentication for private domain connections.
  """

  use Phoenix.Socket
  require Logger

  alias Markdoc.Auth.Cloudflare

  # Channel routes
  channel "doc:*", MarkdocWeb.DocChannel

  @impl true
  def connect(_params, socket, connect_info) do
    host = get_host_from_headers(connect_info)

    if Cloudflare.is_private_domain?(host) do
      # Private domain requires Cloudflare authentication
      case authenticate_cloudflare(connect_info) do
        {:ok, user} ->
          Logger.info("Authenticated user connected to private domain",
            email: user.email,
            domain: :private
          )

          socket =
            socket
            |> assign(:auth_user, %{
              email: user.email,
              sub: user.sub,
              authenticated: true,
              domain: :private
            })

          {:ok, socket}

        {:error, reason} ->
          Logger.warning("Failed to authenticate user on private domain",
            reason: inspect(reason)
          )
          :error
      end
    else
      # Public domain - no authentication required
      socket =
        socket
        |> assign(:auth_user, %{
          email: nil,
          sub: nil,
          authenticated: false,
          domain: :public
        })

      {:ok, socket}
    end
  end

  @impl true
  def id(socket) do
    # Return a unique ID for this socket connection
    # This helps Phoenix Presence track reconnections properly
    # Using the socket's channel_pid as a unique identifier
    "socket:#{:erlang.phash2(socket.channel_pid || self())}"
  end

  ## Private Functions

  defp get_host_from_headers(%{x_headers: headers}) when is_list(headers) do
    headers
    |> Enum.find_value(fn
      {"host", host} -> host
      {"x-forwarded-host", host} -> host
      _ -> nil
    end)
  end

  defp get_host_from_headers(_), do: nil

  defp authenticate_cloudflare(%{x_headers: headers}) when is_list(headers) do
    config = Application.get_env(:markdoc, :auth, [])

    if Keyword.get(config, :dev_mode, false) do
      # Dev mode - authenticate with mock user
      dev_email = Keyword.get(config, :dev_email, "dev@localhost")
      {:ok, %{email: dev_email, sub: "dev-user-#{:erlang.phash2(dev_email)}"}}
    else
      # Production mode - require CF token
      with {:ok, token} <- Cloudflare.extract_token_from_headers(headers),
           {:ok, user} <- Cloudflare.verify_token(token) do
        {:ok, user}
      end
    end
  end

  defp authenticate_cloudflare(_) do
    config = Application.get_env(:markdoc, :auth, [])

    if Keyword.get(config, :dev_mode, false) do
      dev_email = Keyword.get(config, :dev_email, "dev@localhost")
      {:ok, %{email: dev_email, sub: "dev-user-#{:erlang.phash2(dev_email)}"}}
    else
      {:error, :no_headers}
    end
  end
end
