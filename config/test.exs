import Config

# We don't run a server during test. If one is required,
# you can enable the server option below.
config :markdoc, MarkdocWeb.Endpoint,
  http: [ip: {127, 0, 0, 1}, port: 4002],
  secret_key_base: "1EQB8zP/oM2dWwtkfdBGO5VCSpETszXIY9ETaVOA52lGaFaB7nA0+yY98VIGZPL4",
  server: false

# Print only warnings and errors during test
config :logger, level: :warning

# Initialize plugs at runtime for faster test compilation
config :phoenix, :plug_init_mode, :runtime

# Enable helpful, but potentially expensive runtime checks
config :phoenix_live_view,
  enable_expensive_runtime_checks: true

# Test storage uses local disk with fast flush/cleanup intervals
config :markdoc, :storage,
  backend: :disk,
  disk_path: Path.expand("../tmp/storage_test", __DIR__),
  flush_interval_ms: 20,
  idle_flush_ms: 40,
  retention_hours: 1,
  cleanup_interval_ms: 100
