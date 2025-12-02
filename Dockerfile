# Stage 1: Build frontend assets
FROM node:22-slim AS frontend_builder

WORKDIR /app

# Copy frontend project files
COPY frontend/package.json frontend/package-lock.json frontend/
RUN cd frontend && npm install

COPY frontend/ ./frontend/
RUN cd frontend && npm run build


# Stage 2: Build backend release
FROM elixir:1.15.8-alpine AS backend_builder

ENV MIX_ENV=prod

WORKDIR /app

# Install build dependencies
RUN apk --no-cache add build-base git

# Install hex and rebar
RUN mix local.hex --force && mix local.rebar --force

# Copy elixir project files
COPY mix.exs mix.lock ./
COPY config config/
COPY lib lib/
# priv is needed for static assets and esbuild config
COPY priv priv/

# Get dependencies
RUN mix deps.get --only prod --verbose
RUN mix deps.compile

# Copy built frontend assets from the previous stage
COPY --from=frontend_builder /app/priv/static ./priv/static



# Build the release
RUN mix release

# Stage 3: Final image
FROM alpine:latest AS app

WORKDIR /app

# Install runtime dependencies
RUN apk --no-cache add openssl ncurses libstdc++

# Set environment variables
ENV MIX_ENV=prod
ENV PHX_SERVER=true
ENV PORT=4000

# Copy the release from the build stage
COPY --from=backend_builder /app/_build/prod/rel/markdoc .

# Expose the application port
EXPOSE 4000

# The SECRET_KEY_BASE should be set at runtime for security
# e.g., docker run -e SECRET_KEY_BASE=$(mix phx.gen.secret) -p 4000:4000 myapp
CMD ["bin/markdoc", "start"]