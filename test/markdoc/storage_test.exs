defmodule Markdoc.StorageTest do
  use ExUnit.Case, async: false

  alias Markdoc.Storage.DiskAdapter

  setup do
    tmp = Path.join(System.tmp_dir!(), "markdoc-storage-#{System.unique_integer([:positive])}")
    File.rm_rf(tmp)
    File.mkdir_p!(tmp)

    prev_config = Application.get_env(:markdoc, :storage, [])

    Application.put_env(:markdoc, :storage,
      backend: :disk,
      disk_path: tmp,
      flush_interval_ms: 20,
      idle_flush_ms: 40,
      retention_hours: 1,
      cleanup_interval_ms: 100
    )

    on_exit(fn ->
      Application.put_env(:markdoc, :storage, prev_config)
      File.rm_rf(tmp)
    end)

    %{tmp: tmp}
  end

  test "disk adapter persists and loads document", %{tmp: tmp} do
    payload = %{
      doc_id: "abc",
      created_at: 1,
      last_updated_at: 2,
      history: [<<1, 2, 3>>],
      version: 1
    }

    assert :ok = DiskAdapter.persist(payload, path: tmp)
    assert {:ok, loaded} = DiskAdapter.load("abc", path: tmp)
    assert loaded.doc_id == payload.doc_id
    assert loaded.history == payload.history
    assert File.exists?(Path.join(tmp, "abc.meta.json"))
  end

  test "disk adapter lists stale documents", %{tmp: tmp} do
    payload = %{
      doc_id: "old-doc",
      created_at: 0,
      last_updated_at: 0,
      history: [<<1>>],
      version: 1
    }

    assert :ok = DiskAdapter.persist(payload, path: tmp)
    assert {:ok, ["old-doc"]} = DiskAdapter.list_stale(10, path: tmp)
  end

end
