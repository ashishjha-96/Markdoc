defmodule MarkdocWeb.Plugs.CloudflareAuth do
  @moduledoc """
  Plug for authenticating HTTP requests using Cloudflare Zero Trust.

  Extracts and verifies the CF_Authorization cookie from incoming requests.
  If cookie is present, authenticates the user. Otherwise, allows public access.
  Sets `conn.assigns.auth_user` with user information.
  """

  import Plug.Conn
  require Logger

  alias Markdoc.Auth.Cloudflare

  def init(opts), do: opts

  def call(conn, _opts) do
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
      # Check if CF_Authorization cookie is present
      authenticate_if_token_present(conn)
    end
  end

  defp authenticate_if_token_present(conn) do
    conn = fetch_cookies(conn)

    case Cloudflare.extract_token_from_cookies(conn.cookies) do
      {:ok, token} ->
        # Token present - verify it
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
        # No token - public access
        assign(conn, :auth_user, %{
          email: nil,
          sub: nil,
          authenticated: false,
          domain: :public
        })
    end
  end
end
