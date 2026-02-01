defmodule MarkdocWeb.Router do
  use MarkdocWeb, :router

  pipeline :browser do
    plug :accepts, ["html"]
    plug :fetch_session
    plug :fetch_live_flash
    plug :put_root_layout, html: {MarkdocWeb.Layouts, :root}
    plug :protect_from_forgery
    plug :put_secure_browser_headers
  end

  pipeline :api do
    plug :accepts, ["json"]
  end

  pipeline :cloudflare_auth do
    plug MarkdocWeb.Plugs.CloudflareAuth
  end

  # API routes for external integrations (VSCode extension, etc.)
  scope "/api", MarkdocWeb do
    pipe_through :api

    post "/import", ImportController, :create
    get "/import/:doc_id", ImportController, :show
  end

  # API routes requiring Cloudflare authentication
  scope "/api", MarkdocWeb do
    pipe_through [:api, :cloudflare_auth]

    get "/docs/:doc_id/sharing", SharingController, :show
    put "/docs/:doc_id/sharing", SharingController, :update
  end

  scope "/", MarkdocWeb do
    pipe_through :browser

    get "/*path", PageController, :index
  end
end
