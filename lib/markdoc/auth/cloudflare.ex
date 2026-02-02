defmodule Markdoc.Auth.Cloudflare do
  @moduledoc """
  Cloudflare Zero Trust JWT authentication.

  Validates JWTs from the CF_Authorization cookie using Cloudflare's JWKS endpoint.
  Caches JWKS keys with a TTL to minimize network requests.
  """

  require Logger

  @jwks_cache_ttl_ms :timer.hours(24)

  @doc """
  Verifies a Cloudflare Access JWT token.

  Returns `{:ok, %{email: email, sub: sub}}` on success or `{:error, reason}` on failure.

  In dev mode (MARKDOC_AUTH_DEV_MODE=true), returns the dev email without JWT validation.
  """
  def verify_token(token) when is_binary(token) do
    config = auth_config()

    if Keyword.get(config, :dev_mode, false) do
      # Dev mode - return mock user
      dev_email = Keyword.get(config, :dev_email, "dev@localhost")
      Logger.warning("Auth dev mode enabled - returning mock user: #{dev_email}")
      {:ok, %{email: dev_email, sub: "dev-user-#{:erlang.phash2(dev_email)}"}}
    else
      # Production mode - verify JWT
      team_domain = Keyword.fetch!(config, :cloudflare_team_domain)
      aud = Keyword.get(config, :cloudflare_aud)

      with {:ok, jwks} <- get_jwks(team_domain),
           {:ok, claims} <- verify_jwt(token, jwks, team_domain, aud) do
        {:ok, %{email: claims["email"], sub: claims["sub"]}}
      end
    end
  end

  @doc """
  Extracts the CF_Authorization token from cookies in connect_info headers.
  """
  def extract_token_from_headers(headers) when is_list(headers) do
    headers
    |> Enum.find_value(fn
      {"cookie", cookie_string} -> extract_cf_token(cookie_string)
      _ -> nil
    end)
    |> case do
      nil -> {:error, :no_cf_token}
      token -> {:ok, token}
    end
  end

  @doc """
  Extracts the CF_Authorization token from a cookie string in Plug.Conn.
  """
  def extract_token_from_cookies(cookies) when is_map(cookies) do
    case Map.get(cookies, "CF_Authorization") do
      nil -> {:error, :no_cf_token}
      token -> {:ok, token}
    end
  end

  ## Private Functions

  defp auth_config do
    Application.get_env(:markdoc, :auth, [])
  end

  defp extract_cf_token(cookie_string) do
    cookie_string
    |> String.split(";")
    |> Enum.map(&String.trim/1)
    |> Enum.find_value(fn cookie ->
      case String.split(cookie, "=", parts: 2) do
        ["CF_Authorization", value] -> value
        _ -> nil
      end
    end)
  end

  defp get_jwks(team_domain) do
    cache_key = {:jwks_cache, team_domain}

    case :persistent_term.get(cache_key, nil) do
      {jwks, cached_at} when is_list(jwks) ->
        if System.monotonic_time(:millisecond) - cached_at < @jwks_cache_ttl_ms do
          {:ok, jwks}
        else
          fetch_and_cache_jwks(team_domain, cache_key)
        end

      nil ->
        fetch_and_cache_jwks(team_domain, cache_key)
    end
  end

  defp fetch_and_cache_jwks(team_domain, cache_key) do
    jwks_url = "https://#{team_domain}/cdn-cgi/access/certs"

    Logger.info("Fetching JWKS from Cloudflare", url: jwks_url)

    case :httpc.request(:get, {String.to_charlist(jwks_url), []}, [timeout: 10_000], []) do
      {:ok, {{_, 200, _}, _headers, body}} ->
        case Jason.decode(List.to_string(body)) do
          {:ok, %{"keys" => keys}} when is_list(keys) ->
            :persistent_term.put(cache_key, {keys, System.monotonic_time(:millisecond)})
            {:ok, keys}

          {:ok, _} ->
            Logger.error("Invalid JWKS response format")
            {:error, :invalid_jwks_format}

          {:error, reason} ->
            Logger.error("Failed to parse JWKS", reason: inspect(reason))
            {:error, :jwks_parse_error}
        end

      {:ok, {{_, status, _}, _headers, _body}} ->
        Logger.error("JWKS fetch failed", status: status)
        {:error, {:jwks_fetch_failed, status}}

      {:error, reason} ->
        Logger.error("JWKS fetch error", reason: inspect(reason))
        {:error, {:jwks_fetch_error, reason}}
    end
  end

  defp verify_jwt(token, jwks, team_domain, aud) do
    # Decode header to get key ID
    with {:ok, header} <- peek_header(token),
         {:ok, key} <- find_key(jwks, header["kid"]),
         {:ok, signer} <- build_signer(key),
         {:ok, claims} <- Joken.verify(token, signer),
         :ok <- validate_claims(claims, team_domain, aud) do
      {:ok, claims}
    end
  end

  defp peek_header(token) do
    case String.split(token, ".") do
      [header_b64, _, _] ->
        with {:ok, header_json} <- Base.url_decode64(header_b64, padding: false),
             {:ok, header} <- Jason.decode(header_json) do
          {:ok, header}
        else
          _ -> {:error, :invalid_token_header}
        end

      _ ->
        {:error, :invalid_token_format}
    end
  end

  defp find_key(jwks, kid) do
    case Enum.find(jwks, fn key -> key["kid"] == kid end) do
      nil -> {:error, :key_not_found}
      key -> {:ok, key}
    end
  end

  defp build_signer(%{"kty" => "RSA", "n" => n, "e" => e}) do
    {:ok, Joken.Signer.create("RS256", %{"n" => n, "e" => e, "kty" => "RSA"})}
  end

  defp build_signer(%{"kty" => "EC", "crv" => crv, "x" => x, "y" => y}) do
    alg = case crv do
      "P-256" -> "ES256"
      "P-384" -> "ES384"
      "P-521" -> "ES512"
      _ -> nil
    end

    if alg do
      {:ok, Joken.Signer.create(alg, %{"kty" => "EC", "crv" => crv, "x" => x, "y" => y})}
    else
      {:error, :unsupported_curve}
    end
  end

  defp build_signer(_), do: {:error, :unsupported_key_type}

  defp validate_claims(claims, team_domain, aud) do
    now = System.system_time(:second)
    expected_iss = "https://#{team_domain}"

    cond do
      claims["exp"] && claims["exp"] < now ->
        {:error, :token_expired}

      claims["nbf"] && claims["nbf"] > now ->
        {:error, :token_not_yet_valid}

      claims["iss"] != expected_iss ->
        {:error, :invalid_issuer}

      aud && !aud_matches?(claims["aud"], aud) ->
        {:error, :invalid_audience}

      is_nil(claims["email"]) ->
        {:error, :missing_email_claim}

      true ->
        :ok
    end
  end

  defp aud_matches?(token_aud, expected_aud) when is_list(token_aud) do
    expected_aud in token_aud
  end

  defp aud_matches?(token_aud, expected_aud) do
    token_aud == expected_aud
  end
end
