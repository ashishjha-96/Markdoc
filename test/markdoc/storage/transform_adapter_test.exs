defmodule Markdoc.Storage.TransformAdapterTest do
  use ExUnit.Case, async: true

  alias Markdoc.Storage.TransformAdapter

  @test_key :crypto.strong_rand_bytes(32)

  setup do
    tmp = Path.join(System.tmp_dir!(), "markdoc-transform-#{System.unique_integer([:positive])}")
    File.rm_rf(tmp)
    File.mkdir_p!(tmp)

    on_exit(fn ->
      File.rm_rf(tmp)
    end)

    %{tmp: tmp}
  end

  describe "encryption round-trip" do
    test "persists and loads encrypted document", %{tmp: tmp} do
      payload = sample_payload("enc-test")

      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert :ok = TransformAdapter.persist(payload, opts)
      assert {:ok, loaded} = TransformAdapter.load("enc-test", opts)

      assert loaded.doc_id == payload.doc_id
      assert loaded.created_at == payload.created_at
      assert loaded.last_updated_at == payload.last_updated_at
      assert loaded.history == payload.history
      assert loaded.version == payload.version

      # Verify the file is encrypted (not readable JSON)
      enc_file = Path.join(tmp, "enc-test.enc")
      assert File.exists?(enc_file)
      {:ok, raw} = File.read(enc_file)
      # First byte should be version marker, not '{'
      assert <<0x01, _rest::binary>> = raw
    end

    test "compression-only mode works without encryption", %{tmp: tmp} do
      payload = sample_payload("compress-only")

      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: nil,
        compression_enabled: true
      ]

      assert :ok = TransformAdapter.persist(payload, opts)
      assert {:ok, loaded} = TransformAdapter.load("compress-only", opts)

      assert loaded.doc_id == payload.doc_id
      assert loaded.history == payload.history

      # Verify the file is compressed (version byte 0x02)
      enc_file = Path.join(tmp, "compress-only.enc")
      assert File.exists?(enc_file)
      {:ok, raw} = File.read(enc_file)
      assert <<0x02, _rest::binary>> = raw
    end
  end

  describe "backwards compatibility" do
    test "reads legacy disk adapter format (separate meta and data files)", %{tmp: tmp} do
      # Create legacy format files (as DiskAdapter would)
      doc_id = "legacy-doc"

      meta = %{
        "doc_id" => doc_id,
        "created_at" => 1000,
        "last_updated_at" => 2000,
        "version" => 1,
        "owner_email" => "test@example.com",
        "sharing_mode" => "public"
      }

      data = %{
        "history" => [Base.encode64(<<1, 2, 3>>)]
      }

      File.write!(Path.join(tmp, "#{doc_id}.meta.json"), Jason.encode!(meta))
      File.write!(Path.join(tmp, "#{doc_id}.json"), Jason.encode!(data))

      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert {:ok, loaded} = TransformAdapter.load(doc_id, opts)
      assert loaded.doc_id == doc_id
      assert loaded.created_at == 1000
      assert loaded.history == [<<1, 2, 3>>]
      assert loaded.owner_email == "test@example.com"
      assert loaded.sharing_mode == :public
    end

    test "reads legacy S3 format (single JSON file)", %{tmp: tmp} do
      # Simulate legacy S3 format by writing a single JSON blob
      doc_id = "legacy-s3"

      json = %{
        "doc_id" => doc_id,
        "created_at" => 1000,
        "last_updated_at" => 2000,
        "version" => 1,
        "history" => [Base.encode64(<<4, 5, 6>>)],
        "owner_email" => nil,
        "sharing_mode" => nil,
        "allowed_emails" => []
      }

      # Write as .enc file but with JSON content (simulating legacy)
      File.write!(Path.join(tmp, "#{doc_id}.enc"), Jason.encode!(json))

      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert {:ok, loaded} = TransformAdapter.load(doc_id, opts)
      assert loaded.doc_id == doc_id
      assert loaded.history == [<<4, 5, 6>>]
    end
  end

  describe "error handling" do
    test "returns error for encrypted data when no key provided", %{tmp: tmp} do
      payload = sample_payload("needs-key")

      # First persist with encryption
      opts_with_key = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert :ok = TransformAdapter.persist(payload, opts_with_key)

      # Try to load without key
      opts_no_key = [
        storage_type: :disk,
        path: tmp,
        encryption_key: nil,
        compression_enabled: true
      ]

      assert {:error, :encryption_key_required} = TransformAdapter.load("needs-key", opts_no_key)
    end

    test "detects tampered ciphertext", %{tmp: tmp} do
      payload = sample_payload("tamper-test")

      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert :ok = TransformAdapter.persist(payload, opts)

      # Tamper with the encrypted file
      enc_file = Path.join(tmp, "tamper-test.enc")
      {:ok, raw} = File.read(enc_file)
      # Flip some bits in the ciphertext (after version + IV + tag)
      <<version::binary-size(1), iv::binary-size(12), tag::binary-size(16), ciphertext::binary>> = raw
      # Just flip the first 4 bytes of ciphertext
      <<first4::binary-size(4), rest::binary>> = ciphertext
      tampered_first4 = :crypto.exor(first4, <<255, 255, 255, 255>>)
      tampered_ciphertext = <<tampered_first4::binary, rest::binary>>
      tampered = <<version::binary, iv::binary, tag::binary, tampered_ciphertext::binary>>
      File.write!(enc_file, tampered)

      assert {:error, :decryption_failed} = TransformAdapter.load("tamper-test", opts)
    end

    test "returns error for wrong key", %{tmp: tmp} do
      payload = sample_payload("wrong-key")

      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert :ok = TransformAdapter.persist(payload, opts)

      # Try to load with different key
      wrong_key = :crypto.strong_rand_bytes(32)

      opts_wrong_key = [
        storage_type: :disk,
        path: tmp,
        encryption_key: wrong_key,
        compression_enabled: true
      ]

      assert {:error, :decryption_failed} = TransformAdapter.load("wrong-key", opts_wrong_key)
    end

    test "returns :not_found for missing document", %{tmp: tmp} do
      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert :not_found = TransformAdapter.load("nonexistent", opts)
    end
  end

  describe "delete" do
    test "deletes encrypted document", %{tmp: tmp} do
      payload = sample_payload("to-delete")

      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert :ok = TransformAdapter.persist(payload, opts)
      assert File.exists?(Path.join(tmp, "to-delete.enc"))

      assert :ok = TransformAdapter.delete("to-delete", opts)
      refute File.exists?(Path.join(tmp, "to-delete.enc"))
      assert :not_found = TransformAdapter.load("to-delete", opts)
    end

    test "deletes both encrypted and legacy files", %{tmp: tmp} do
      doc_id = "mixed-delete"

      # Create legacy files
      File.write!(Path.join(tmp, "#{doc_id}.json"), "{}")
      File.write!(Path.join(tmp, "#{doc_id}.meta.json"), "{}")
      # Create encrypted files
      File.write!(Path.join(tmp, "#{doc_id}.enc"), "test")
      File.write!(Path.join(tmp, "#{doc_id}.enc.meta"), "{}")

      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert :ok = TransformAdapter.delete(doc_id, opts)

      refute File.exists?(Path.join(tmp, "#{doc_id}.json"))
      refute File.exists?(Path.join(tmp, "#{doc_id}.meta.json"))
      refute File.exists?(Path.join(tmp, "#{doc_id}.enc"))
      refute File.exists?(Path.join(tmp, "#{doc_id}.enc.meta"))
    end
  end

  describe "list_stale" do
    test "lists stale encrypted documents", %{tmp: tmp} do
      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      # Create old document
      old_payload = %{sample_payload("old-doc") | created_at: 1000}
      assert :ok = TransformAdapter.persist(old_payload, opts)

      # Create new document
      new_payload = %{sample_payload("new-doc") | created_at: 9999}
      assert :ok = TransformAdapter.persist(new_payload, opts)

      # List documents older than 5000
      assert {:ok, stale} = TransformAdapter.list_stale(5000, opts)
      assert "old-doc" in stale
      refute "new-doc" in stale
    end
  end

  describe "decode_key" do
    test "decodes valid Base64 32-byte key" do
      # Generate a 32-byte key and encode it
      raw_key = :crypto.strong_rand_bytes(32)
      base64_key = Base.encode64(raw_key)

      assert {:ok, ^raw_key} = TransformAdapter.decode_key(base64_key)
    end

    test "returns error for wrong key size" do
      # 16-byte key (too short)
      short_key = :crypto.strong_rand_bytes(16)
      base64_short = Base.encode64(short_key)

      assert {:error, {:invalid_key_size, 16}} = TransformAdapter.decode_key(base64_short)
    end

    test "returns error for invalid Base64" do
      assert {:error, :invalid_base64} = TransformAdapter.decode_key("not-valid-base64!!!")
    end

    test "returns nil for nil input" do
      assert {:ok, nil} = TransformAdapter.decode_key(nil)
    end
  end

  describe "payload fields preservation" do
    test "preserves all payload fields through encryption", %{tmp: tmp} do
      payload = %{
        doc_id: "full-payload",
        created_at: 12345,
        last_updated_at: 67890,
        history: [<<1, 2, 3>>, <<4, 5, 6>>, <<7, 8, 9>>],
        version: 42,
        owner_email: "owner@example.com",
        owner_sub: "sub-123",
        sharing_mode: :specific_people,
        allowed_emails: ["alice@example.com", "bob@example.com"]
      }

      opts = [
        storage_type: :disk,
        path: tmp,
        encryption_key: @test_key,
        compression_enabled: true
      ]

      assert :ok = TransformAdapter.persist(payload, opts)
      assert {:ok, loaded} = TransformAdapter.load("full-payload", opts)

      assert loaded.doc_id == payload.doc_id
      assert loaded.created_at == payload.created_at
      assert loaded.last_updated_at == payload.last_updated_at
      assert loaded.history == payload.history
      assert loaded.version == payload.version
      assert loaded.owner_email == payload.owner_email
      assert loaded.owner_sub == payload.owner_sub
      assert loaded.sharing_mode == payload.sharing_mode
      assert loaded.allowed_emails == payload.allowed_emails
    end
  end

  # Helper function to create sample payloads
  defp sample_payload(doc_id) do
    %{
      doc_id: doc_id,
      created_at: System.system_time(:millisecond),
      last_updated_at: System.system_time(:millisecond),
      history: [<<1, 2, 3>>, <<4, 5, 6>>],
      version: 1,
      owner_email: nil,
      owner_sub: nil,
      sharing_mode: nil,
      allowed_emails: []
    }
  end
end
