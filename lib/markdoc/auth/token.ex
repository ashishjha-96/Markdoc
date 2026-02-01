defmodule Markdoc.Auth.Token do
  @moduledoc """
  Joken token configuration for Cloudflare Access JWT validation.

  This module provides the token configuration used by the Cloudflare auth module
  to validate JWTs issued by Cloudflare Access.
  """

  use Joken.Config

  @doc """
  Creates a token configuration for validating Cloudflare Access JWTs.
  """
  def token_config do
    config = Application.get_env(:markdoc, :auth, [])
    team_domain = Keyword.get(config, :cloudflare_team_domain, "markdoc.cloudflareaccess.com")
    aud = Keyword.get(config, :cloudflare_aud)

    default_claims(skip: [:aud, :iss])
    |> add_claim("iss", nil, &validate_issuer(&1, team_domain))
    |> add_claim("aud", nil, &validate_audience(&1, aud))
    |> add_claim("email", nil, &is_binary/1)
  end

  defp validate_issuer(iss, team_domain) do
    expected = "https://#{team_domain}"
    iss == expected
  end

  defp validate_audience(_aud, nil), do: true
  defp validate_audience(aud, expected) when is_list(aud), do: expected in aud
  defp validate_audience(aud, expected), do: aud == expected

  @doc """
  Returns the JWKS URL for the configured Cloudflare team domain.
  """
  def jwks_url do
    config = Application.get_env(:markdoc, :auth, [])
    team_domain = Keyword.get(config, :cloudflare_team_domain, "markdoc.cloudflareaccess.com")
    "https://#{team_domain}/cdn-cgi/access/certs"
  end
end
