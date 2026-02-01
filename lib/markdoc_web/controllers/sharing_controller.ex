defmodule MarkdocWeb.SharingController do
  @moduledoc """
  Controller for managing document sharing settings.

  Provides API endpoints for viewing and updating document sharing configuration.
  All endpoints require authentication on the private domain.
  """

  use MarkdocWeb, :controller
  require Logger

  alias Markdoc.{DocServer, DocSupervisor, DocRegistry}

  @doc """
  GET /api/docs/:doc_id/sharing

  Returns the sharing settings for a document. Only the document owner can view.
  """
  def show(conn, %{"doc_id" => doc_id}) do
    auth_user = conn.assigns[:auth_user]

    with :ok <- ensure_authenticated(auth_user),
         :ok <- ensure_doc_exists(doc_id),
         metadata <- DocServer.get_metadata(doc_id),
         :ok <- ensure_owner(auth_user, metadata) do
      json(conn, %{
        doc_id: doc_id,
        sharing_mode: metadata.sharing_mode,
        allowed_emails: metadata.allowed_emails,
        owner_email: metadata.owner_email
      })
    else
      {:error, :not_authenticated} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "unauthorized", reason: "authentication_required"})

      {:error, :not_owner} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "forbidden", reason: "not_owner"})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "internal_error", reason: inspect(reason)})
    end
  end

  @doc """
  PUT /api/docs/:doc_id/sharing

  Updates the sharing settings for a document. Only the document owner can update.

  Request body:
  - sharing_mode: "only_me" | "specific_people" | "authenticated_users" | "public"
  - allowed_emails: [string] (only used when sharing_mode is "specific_people")
  """
  def update(conn, %{"doc_id" => doc_id} = params) do
    auth_user = conn.assigns[:auth_user]

    with :ok <- ensure_authenticated(auth_user),
         :ok <- ensure_doc_exists(doc_id),
         metadata <- DocServer.get_metadata(doc_id),
         :ok <- ensure_owner(auth_user, metadata),
         {:ok, settings} <- parse_sharing_settings(params) do
      case DocServer.update_sharing(doc_id, auth_user.email, settings) do
        :ok ->
          Logger.info("Sharing settings updated",
            doc_id: doc_id,
            sharing_mode: settings.sharing_mode,
            allowed_emails_count: length(Map.get(settings, :allowed_emails, []))
          )

          json(conn, %{
            success: true,
            doc_id: doc_id,
            sharing_mode: settings.sharing_mode,
            allowed_emails: Map.get(settings, :allowed_emails, [])
          })

        {:error, reason} ->
          conn
          |> put_status(:bad_request)
          |> json(%{error: "update_failed", reason: inspect(reason)})
      end
    else
      {:error, :not_authenticated} ->
        conn
        |> put_status(:unauthorized)
        |> json(%{error: "unauthorized", reason: "authentication_required"})

      {:error, :not_owner} ->
        conn
        |> put_status(:forbidden)
        |> json(%{error: "forbidden", reason: "not_owner"})

      {:error, :invalid_sharing_mode} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "bad_request", reason: "invalid_sharing_mode"})

      {:error, :invalid_emails} ->
        conn
        |> put_status(:bad_request)
        |> json(%{error: "bad_request", reason: "invalid_emails_format"})

      {:error, reason} ->
        conn
        |> put_status(:internal_server_error)
        |> json(%{error: "internal_error", reason: inspect(reason)})
    end
  end

  ## Private Functions

  defp ensure_authenticated(%{authenticated: true}), do: :ok
  defp ensure_authenticated(_), do: {:error, :not_authenticated}

  defp ensure_doc_exists(doc_id) do
    case DocRegistry.lookup(doc_id) do
      [] ->
        case DocSupervisor.start_doc(doc_id) do
          {:ok, _pid} -> :ok
          {:error, {:already_started, _pid}} -> :ok
          error -> error
        end

      [{_pid, _}] ->
        :ok
    end
  end

  defp ensure_owner(auth_user, metadata) do
    cond do
      is_nil(metadata.owner_email) ->
        # Document has no owner yet - this shouldn't happen for sharing endpoint
        {:error, :not_owner}

      auth_user.email == metadata.owner_email ->
        :ok

      true ->
        {:error, :not_owner}
    end
  end

  defp parse_sharing_settings(params) do
    case parse_sharing_mode(params["sharing_mode"]) do
      {:error, :invalid} ->
        {:error, :invalid_sharing_mode}

      mode ->
        case parse_allowed_emails(params["allowed_emails"]) do
          :error ->
            {:error, :invalid_emails}

          emails ->
            {:ok, %{sharing_mode: mode, allowed_emails: emails}}
        end
    end
  end

  defp parse_sharing_mode("only_me"), do: :only_me
  defp parse_sharing_mode("specific_people"), do: :specific_people
  defp parse_sharing_mode("authenticated_users"), do: :authenticated_users
  defp parse_sharing_mode("public"), do: :public
  defp parse_sharing_mode(_), do: {:error, :invalid}

  defp parse_allowed_emails(nil), do: []
  defp parse_allowed_emails(emails) when is_list(emails) do
    if Enum.all?(emails, &is_binary/1) do
      emails
      |> Enum.map(&String.trim/1)
      |> Enum.filter(&(String.length(&1) > 0))
      |> Enum.take(50)
    else
      :error
    end
  end
  defp parse_allowed_emails(_), do: :error
end
