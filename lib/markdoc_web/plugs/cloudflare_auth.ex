defmodule MarkdocWeb.Plugs.CloudflareAuth do
  @moduledoc """
  Plug for authenticating HTTP requests using Cloudflare Zero Trust.

  Extracts and verifies the CF_Authorization cookie from incoming requests
  on the private domain. Sets `conn.assigns.auth_user` with user information.
  """

  import Plug.Conn
  require Logger

  alias Markdoc.Auth.Cloudflare

  def init(opts), do: opts

  def call(conn, _opts) do
    host = get_host(conn)

    if Cloudflare.is_private_domain?(host) do
      authenticate(conn)
    else
      # Public domain - set unauthenticated user
      assign(conn, :auth_user, %{
        email: nil,
        sub: nil,
        authenticated: false,
        domain: :public
      })
    end
  end

  defp get_host(conn) do
    # Try x-forwarded-host first (for proxied requests), then fall back to host header
    case get_req_header(conn, "x-forwarded-host") do
      [host | _] -> host
      [] ->
        case get_req_header(conn, "host") do
          [host | _] -> host
          [] -> nil
        end
    end
  end

  defp authenticate(conn) do
    config = Application.get_env(:markdoc, :auth, [])

    if Keyword.get(config, :dev_mode, false) do
      # Dev mode - authenticate with mock user
      dev_email = Keyword.get(config, :dev_email, "dev@localhost")
      Logger.debug("Auth dev mode - using mock user: #{dev_email}")

      assign(conn, :auth_user, %{
        email: dev_email,
        sub: "dev-user-#{:erlang.phash2(dev_email)}",
        authenticated: true,
        domain: :private
      })
    else
      # Production mode - require CF token
      authenticate_with_token(conn)
    end
  end

  defp authenticate_with_token(conn) do
    conn = fetch_cookies(conn)

    case Cloudflare.extract_token_from_cookies(conn.cookies) do
      {:ok, token} ->
        case Cloudflare.verify_token(token) do
          {:ok, user} ->
            Logger.debug("Authenticated user via CF token",
              email: user.email
            )

            assign(conn, :auth_user, %{
              email: user.email,
              sub: user.sub,
              authenticated: true,
              domain: :private
            })

          {:error, reason} ->
            Logger.warning("CF token verification failed",
              reason: inspect(reason)
            )

            conn
            |> put_status(:unauthorized)
            |> Phoenix.Controller.json(%{error: "unauthorized", reason: "invalid_token"})
            |> halt()
        end

      {:error, :no_cf_token} ->
        Logger.warning("No CF_Authorization cookie found on private domain")

        conn
        |> put_status(:unauthorized)
        |> Phoenix.Controller.json(%{error: "unauthorized", reason: "missing_token"})
        |> halt()
    end
  end
end
