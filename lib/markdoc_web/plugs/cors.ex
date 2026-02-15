defmodule MarkdocWeb.Plugs.CORS do
  @moduledoc """
  Simple CORS plug for the import API.
  Scoped to /api/import paths so external apps can POST markdown content.
  """

  import Plug.Conn

  def init(opts), do: opts

  def call(%{request_path: "/api/import" <> _} = conn, _opts) do
    conn
    |> put_resp_header("access-control-allow-origin", "*")
    |> put_resp_header("access-control-allow-methods", "GET, POST, OPTIONS")
    |> put_resp_header("access-control-allow-headers", "content-type")
    |> handle_preflight()
  end

  def call(conn, _opts), do: conn

  defp handle_preflight(%{method: "OPTIONS"} = conn) do
    conn
    |> send_resp(204, "")
    |> halt()
  end

  defp handle_preflight(conn), do: conn
end
