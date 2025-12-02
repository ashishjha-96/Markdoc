defmodule Markdoc.DocSupervisor do
  @moduledoc """
  DynamicSupervisor for document server processes.

  Spawns and manages DocServer processes on-demand. Each active document
  gets its own supervised GenServer process that lives in memory.
  """

  use DynamicSupervisor

  @doc """
  Starts the DocSupervisor.
  """
  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end

  @doc """
  Starts a new document server process for the given doc_id.

  Returns {:ok, pid} if successfully started, or {:error, {:already_started, pid}}
  if a process for this doc_id already exists.

  ## Examples

      iex> Markdoc.DocSupervisor.start_doc("meeting-notes")
      {:ok, #PID<0.123.0>}

      iex> Markdoc.DocSupervisor.start_doc("meeting-notes")
      {:error, {:already_started, #PID<0.123.0>}}
  """
  def start_doc(doc_id) when is_binary(doc_id) do
    spec = {Markdoc.DocServer, doc_id}
    DynamicSupervisor.start_child(__MODULE__, spec)
  end

  @doc """
  Returns the count of active document processes.
  """
  def count_documents do
    __MODULE__
    |> DynamicSupervisor.count_children()
    |> Map.get(:active, 0)
  end

  @doc """
  Lists all active document process PIDs.
  """
  def list_documents do
    __MODULE__
    |> DynamicSupervisor.which_children()
    |> Enum.map(fn {_, pid, _, _} -> pid end)
  end
end
