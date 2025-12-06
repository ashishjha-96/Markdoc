import Config

# config/runtime.exs is executed for all environments, including
# during releases. It is executed after compilation and before the
# system starts, so it is typically used to load production configuration
# and secrets from environment variables or elsewhere. Do not define
# any compile-time configuration in here, as it won't be applied.
# The block below contains prod specific runtime configuration.

# ## Using releases
#
# If you use `mix release`, you need to explicitly enable the server
# by passing the PHX_SERVER=true when you start it:
#
#     PHX_SERVER=true bin/markdoc start
#
# Alternatively, you can use `mix phx.gen.release` to generate a `bin/server`
# script that automatically sets the env var above.
if System.get_env("PHX_SERVER") do
  config :markdoc, MarkdocWeb.Endpoint, server: true
end

if config_env() == :prod do
  # The secret key base is used to sign/encrypt cookies and other secrets.
  # A default value is used in config/dev.exs and config/test.exs but you
  # want to use a different value for prod and you most likely don't want
  # to check this value into version control, so we use an environment
  # variable instead.
  secret_key_base =
    System.get_env("SECRET_KEY_BASE") ||
      raise """
      environment variable SECRET_KEY_BASE is missing.
      You can generate one by calling: mix phx.gen.secret
      """

  host = System.get_env("PHX_HOST") || "example.com"
  port = String.to_integer(System.get_env("PORT") || "4000")

  config :markdoc, :dns_cluster_query, System.get_env("DNS_CLUSTER_QUERY")

  allowed_origins =
    System.get_env("ALLOWED_ORIGINS", "http://localhost:4000,http://localhost:5173")
    |> String.split(",", trim: true)

  config :markdoc, MarkdocWeb.Endpoint,
    url: [host: host, port: 443, scheme: "https"],
    http: [
      # Enable IPv6 and bind on all interfaces.
      # Set it to  {0, 0, 0, 0, 0, 0, 0, 1} for local network only access.
      # See the documentation on https://hexdocs.pm/bandit/Bandit.html#t:options/0
      # for details about using IPv6 vs IPv4 and loopback vs public addresses.
      ip: {0, 0, 0, 0, 0, 0, 0, 0},
      port: port
    ],
    secret_key_base: secret_key_base,
    check_origin: allowed_origins

  # ## SSL Support
  #
  # To get SSL working, you will need to add the `https` key
  # to your endpoint configuration:
  #
  #     config :markdoc, MarkdocWeb.Endpoint,
  #       https: [
  #         ...,
  #         port: 443,
  #         cipher_suite: :strong,
  #         keyfile: System.get_env("SOME_APP_SSL_KEY_PATH"),
  #         certfile: System.get_env("SOME_APP_SSL_CERT_PATH")
  #       ]
  #
  # The `cipher_suite` is set to `:strong` to support only the
  # latest and more secure SSL ciphers. This means old browsers
  # and clients may not be supported. You can set it to
  # `:compatible` for wider support.
  #
  # `:keyfile` and `:certfile` expect an absolute path to the key
  # and cert in disk or a relative path inside priv, for example
  # "priv/ssl/server.key". For all supported SSL configuration
  # options, see https://hexdocs.pm/plug/Plug.SSL.html#configure/1
  #
  # We also recommend setting `force_ssl` in your config/prod.exs,
  # ensuring no data is ever sent via http, always redirecting to https:
  #
  #     config :markdoc, MarkdocWeb.Endpoint,
  #       force_ssl: [hsts: true]
  #
  # Check `Plug.SSL` for all available options in `force_ssl`.
end

base_storage_config = Application.get_env(:markdoc, :storage, [])

env_int = fn name, default ->
  case System.get_env(name) do
    nil -> default
    val -> String.to_integer(val)
  end
end

env_backend =
  case System.get_env("MARKDOC_STORAGE_BACKEND") do
    "s3" -> :s3
    "disk" -> :disk
    "none" -> :none
    _ -> Keyword.get(base_storage_config, :backend, :none)
  end

config :markdoc, :storage,
  backend: env_backend,
  disk_path: System.get_env("MARKDOC_STORAGE_PATH") || Keyword.get(base_storage_config, :disk_path),
  s3_bucket: System.get_env("MARKDOC_S3_BUCKET") || Keyword.get(base_storage_config, :s3_bucket),
  s3_prefix: System.get_env("MARKDOC_S3_PREFIX") || Keyword.get(base_storage_config, :s3_prefix, "documents/"),
  flush_interval_ms:
    env_int.("MARKDOC_FLUSH_INTERVAL_MS", Keyword.get(base_storage_config, :flush_interval_ms, 30_000)),
  idle_flush_ms:
    env_int.("MARKDOC_IDLE_FLUSH_MS", Keyword.get(base_storage_config, :idle_flush_ms, 300_000)),
  retention_hours:
    env_int.("MARKDOC_RETENTION_HOURS", Keyword.get(base_storage_config, :retention_hours, 24)),
  cleanup_interval_ms:
    env_int.("MARKDOC_CLEANUP_INTERVAL_MS", Keyword.get(base_storage_config, :cleanup_interval_ms, 900_000))

# ExAws (S3) runtime configuration for AWS or S3-compatible endpoints
exaws_region = System.get_env("MARKDOC_S3_REGION") || System.get_env("AWS_REGION") || System.get_env("AWS_DEFAULT_REGION")
exaws_access_key = System.get_env("MARKDOC_S3_ACCESS_KEY_ID") || System.get_env("AWS_ACCESS_KEY_ID")
exaws_secret = System.get_env("MARKDOC_S3_SECRET_ACCESS_KEY") || System.get_env("AWS_SECRET_ACCESS_KEY")
exaws_host = System.get_env("MARKDOC_S3_HOST")
exaws_scheme = System.get_env("MARKDOC_S3_SCHEME") || "https://"
exaws_port = System.get_env("MARKDOC_S3_PORT")

if env_backend == :s3 do
  maybe_put_env = fn
    opts, _key, nil -> opts
    opts, key, val -> Keyword.put(opts, key, val)
  end

  config :ex_aws,
    region: exaws_region,
    access_key_id: exaws_access_key || :instance_role,
    secret_access_key: exaws_secret || :instance_role

  s3_opts =
    []
    |> maybe_put_env.(:scheme, exaws_scheme)
    |> maybe_put_env.(:host, exaws_host)
    |> maybe_put_env.(:port, (exaws_port && String.to_integer(exaws_port)) || nil)
    |> maybe_put_env.(:region, exaws_region)

  config :ex_aws, :s3, s3_opts
end
