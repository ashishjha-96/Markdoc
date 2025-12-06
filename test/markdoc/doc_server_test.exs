defmodule Markdoc.DocServerTest do
  use ExUnit.Case, async: false

  alias Markdoc.DocServer
  alias Markdoc.Storage.DiskAdapter

  setup do
    doc_id = "doc-#{System.unique_integer([:positive])}"
    tmp = Path.join(System.tmp_dir!(), "markdoc-docserver-#{doc_id}")
    File.rm_rf(tmp)
    File.mkdir_p!(tmp)

    prev_config = Application.get_env(:markdoc, :storage, [])

    Application.put_env(:markdoc, :storage,
      backend: :disk,
      disk_path: tmp,
      flush_interval_ms: 10,
      idle_flush_ms: 20,
      retention_hours: 1,
      cleanup_interval_ms: 50
    )

    {:ok, pid} =
      start_supervised(%{
        id: {:doc_server, doc_id},
        start: {DocServer, :start_link, [doc_id]}
      })

    on_exit(fn ->
      Application.put_env(:markdoc, :storage, prev_config)
      File.rm_rf(tmp)
    end)

    %{doc_id: doc_id, pid: pid, tmp: tmp}
  end

  test "flushes history on periodic flush", %{doc_id: doc_id, pid: pid, tmp: tmp} do
    DocServer.add_update(doc_id, <<1, 2, 3>>)

    send(pid, :periodic_flush)
    Process.sleep(20)

    assert {:ok, loaded} = DiskAdapter.load(doc_id, path: tmp)
    assert loaded.history == [<<1, 2, 3>>]
  end

  test "hydrates from persisted storage on spawn", %{tmp: tmp} do
    persisted_id = "persisted-#{System.unique_integer([:positive])}"

    payload = %{
      doc_id: persisted_id,
      created_at: 1,
      last_updated_at: 2,
      history: [<<9, 9>>],
      version: 1
    }

    :ok = DiskAdapter.persist(payload, path: tmp)

    {:ok, pid} =
      start_supervised(%{
        id: {:doc_server, persisted_id},
        start: {DocServer, :start_link, [persisted_id]}
      })

    assert DocServer.get_history(persisted_id) == [<<9, 9>>]

    # cleanup process to silence warnings
    Process.exit(pid, :normal)
  end
end
