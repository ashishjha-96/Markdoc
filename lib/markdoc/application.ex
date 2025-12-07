defmodule Markdoc.Application do
  # See https://hexdocs.pm/elixir/Application.html
  # for more information on OTP Applications
  @moduledoc false

  use Application
  require Logger

  @impl true
  def start(_type, _args) do
    children = [
      MarkdocWeb.Telemetry,
      {DNSCluster, query: Application.get_env(:markdoc, :dns_cluster_query) || :ignore},
      {Phoenix.PubSub, name: Markdoc.PubSub},
      # Document Registry for process naming
      Markdoc.DocRegistry,
      # Document Supervisor for dynamic doc processes
      Markdoc.DocSupervisor,
      # Retention cleanup worker
      Markdoc.Storage.CleanupWorker,
      # Presence tracking for collaborative features
      MarkdocWeb.Presence,
      # System monitoring and stats logging
      Markdoc.Monitor,
      # Start to serve requests, typically the last entry
      MarkdocWeb.Endpoint
    ]

    # See https://hexdocs.pm/elixir/Supervisor.html
    # for other strategies and supported options
    opts = [strategy: :one_for_one, name: Markdoc.Supervisor]
    Supervisor.start_link(children, opts)
  end

  @impl true
  def stop(_state) do
    doc_ids =
      Registry.select(Markdoc.DocRegistry, [
        {{:"$1", :_, :_}, [], [:"$1"]}
      ])

    Enum.each(doc_ids, fn doc_id ->
      try do
        Markdoc.DocServer.flush(doc_id)
      catch
        :exit, reason ->
          Logger.warning("Failed to flush document on shutdown",
            event: :flush_failed,
            doc_id: doc_id,
            reason: inspect(reason)
          )

        :error, reason ->
          Logger.warning("Failed to flush document on shutdown",
            event: :flush_failed,
            doc_id: doc_id,
            reason: inspect(reason)
          )
      end
    end)

    :ok
  end

  # Tell Phoenix to update the endpoint configuration
  # whenever the application is updated.
  @impl true
  def config_change(changed, _new, removed) do
    MarkdocWeb.Endpoint.config_change(changed, removed)
    :ok
  end
end
