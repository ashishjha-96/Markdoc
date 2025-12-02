defmodule MarkdocWeb.PageController do
  use MarkdocWeb, :controller

  def home(conn, _params) do
    render(conn, :home)
  end

  def index(conn, _params) do
    static_path = Path.join(:code.priv_dir(:markdoc), "static/index.html")

    conn
    |> put_resp_header("content-type", "text/html; charset=utf-8")
    |> send_file(200, static_path)
    |> halt()
  end
end
