defmodule MarkdocWeb.ImportController do
  @moduledoc """
  Controller for handling markdown imports from external sources like the VSCode extension.
  """

  use MarkdocWeb, :controller

  alias Markdoc.PendingImports

  @max_markdown_size 1_000_000  # 1MB limit

  @doc """
  POST /api/import

  Accepts markdown content, stores it temporarily, and returns a doc_id and URL.
  The frontend can then fetch this pending import when the user opens the URL.

  Request body: { "markdown": "# Hello World" }
  Response: { "doc_id": "abc123xy", "url": "https://markdoc.live/abc123xy?import=true" }
  """
  def create(conn, %{"markdown" => markdown}) when is_binary(markdown) do
    cond do
      byte_size(markdown) > @max_markdown_size ->
        conn
        |> put_status(:request_entity_too_large)
        |> json(%{error: "Markdown content exceeds maximum size of 1MB"})

      byte_size(markdown) == 0 ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "Markdown content cannot be empty"})

      true ->
        {:ok, doc_id} = PendingImports.store(markdown)

        # Build the URL based on the request
        base_url = get_base_url(conn)
        url = "#{base_url}/#{doc_id}?import=true"

        conn
        |> put_status(:created)
        |> json(%{doc_id: doc_id, url: url})
    end
  end

  def create(conn, _params) do
    conn
    |> put_status(:bad_request)
    |> json(%{error: "Missing required field: markdown"})
  end

  @doc """
  GET /api/import/:doc_id

  Retrieves pending markdown content for import.
  This is a one-time read - the content is deleted after retrieval.

  Response: { "markdown": "# Hello World" }
  """
  def show(conn, %{"doc_id" => doc_id}) do
    case PendingImports.fetch(doc_id) do
      {:ok, markdown} ->
        json(conn, %{markdown: markdown})

      :not_found ->
        conn
        |> put_status(:not_found)
        |> json(%{error: "Import not found or expired"})
    end
  end

  defp get_base_url(conn) do
    scheme = if conn.scheme == :https, do: "https", else: "http"
    host = conn.host
    port = conn.port

    case {scheme, port} do
      {"https", 443} -> "#{scheme}://#{host}"
      {"http", 80} -> "#{scheme}://#{host}"
      _ -> "#{scheme}://#{host}:#{port}"
    end
  end
end
