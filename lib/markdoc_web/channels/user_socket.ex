defmodule MarkdocWeb.UserSocket do
  @moduledoc """
  WebSocket connection handler.

  Defines the channel routes and connection logic for the application.
  All document collaboration happens through the "doc:*" channel.

  Handles Cloudflare Zero Trust authentication when CF_Authorization cookie is present.
  """

  use Phoenix.Socket
  require Logger

  alias Markdoc.Auth.Cloudflare

  # Channel routes
  channel "doc:*", MarkdocWeb.DocChannel

  @impl true
  def connect(_params, socket, connect_info) do
    # Check if CF_Authorization cookie is present - if so, authenticate
    case try_cloudflare_auth(connect_info) do
      {:ok, user} ->
        # Authenticated via Cloudflare Zero Trust
        Logger.info("Authenticated user connected",
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

      :not_present ->
        # No CF token - public access
        socket =
          socket
          |> assign(:auth_user, %{
            email: nil,
            sub: nil,
            authenticated: false,
            domain: :public
          })

        {:ok, socket}

      {:error, reason} ->
        # CF token present but invalid - reject connection
        Logger.warning("Failed to authenticate Cloudflare token",
          reason: inspect(reason)
        )
        :error
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

  defp try_cloudflare_auth(%{x_headers: headers}) when is_list(headers) do
    config = Application.get_env(:markdoc, :auth, [])

    if Keyword.get(config, :dev_mode, false) do
      # Dev mode - authenticate with mock user
      dev_email = Keyword.get(config, :dev_email, "dev@localhost")
      {:ok, %{email: dev_email, sub: "dev-user-#{:erlang.phash2(dev_email)}"}}
    else
      # Check if CF_Authorization cookie exists
      case Cloudflare.extract_token_from_headers(headers) do
        {:ok, token} ->
          # Token present - verify it
          Cloudflare.verify_token(token)

        {:error, :no_cf_token} ->
          # No token - public access
          :not_present
      end
    end
  end

  defp try_cloudflare_auth(_) do
    config = Application.get_env(:markdoc, :auth, [])

    if Keyword.get(config, :dev_mode, false) do
      dev_email = Keyword.get(config, :dev_email, "dev@localhost")
      {:ok, %{email: dev_email, sub: "dev-user-#{:erlang.phash2(dev_email)}"}}
    else
      :not_present
    end
  end
end
