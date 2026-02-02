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
  def connect(params, socket, connect_info) do
    # Debug: log what we're receiving
    headers = Map.get(connect_info, :x_headers, [])
    cf_token_from_params = Map.get(params, "cf_token")

    Logger.info("Socket connect_info",
      x_headers_count: length(headers),
      has_cookie_header: Enum.any?(headers, fn {k, _} -> k == "cookie" end),
      has_token_param: cf_token_from_params != nil
    )

    # Check if CF_Authorization token is present - try params first, then headers
    case try_cloudflare_auth(params, connect_info) do
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

  defp try_cloudflare_auth(params, connect_info) do
    config = Application.get_env(:markdoc, :auth, [])

    if Keyword.get(config, :dev_mode, false) do
      # Dev mode - authenticate with mock user
      dev_email = Keyword.get(config, :dev_email, "dev@localhost")
      {:ok, %{email: dev_email, sub: "dev-user-#{:erlang.phash2(dev_email)}"}}
    else
      # Try to get token from params first (passed by frontend)
      # Treat "undefined" string as no token (JavaScript quirk)
      cf_token = case Map.get(params, "cf_token") do
        nil -> nil
        "undefined" -> nil
        "" -> nil
        token -> token
      end

      # Fall back to extracting from cookie header
      cf_token = cf_token || extract_token_from_connect_info(connect_info)

      case cf_token do
        nil ->
          :not_present

        token ->
          Cloudflare.verify_token(token)
      end
    end
  end

  defp extract_token_from_connect_info(%{x_headers: headers}) when is_list(headers) do
    case Cloudflare.extract_token_from_headers(headers) do
      {:ok, token} -> token
      {:error, _} -> nil
    end
  end

  defp extract_token_from_connect_info(_), do: nil
end
