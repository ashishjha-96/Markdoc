This approach is the **"Client-Side Snapshot" Pattern**.

Since your backend is lightweight (Ephemereal) and doesn't natively speak Y.js (Rust/Wasm), we don't want to burden it with compiling complex Rust NIFs just to merge binary blobs. Instead, we will ask a connected client—who already has the heavy Y.js engine running—to do the work for us.

### The Logic Flow

1.  **Monitor:** The Server counts how many updates it has received (e.g., 50 updates).
2.  **Request:** When the limit is hit, the Server asks **one** random connected client: *"Hey, please compress the document."*
3.  **Compress:** That client performs `Y.encodeStateAsUpdate(doc)`, creating one single binary blob representing the whole document.
4.  **Replace:** The client sends this back. The Server **discards** its old history list and replaces it with this single blob.

-----

### 1\. The Backend (Elixir)

We update the `DocServer` to track the count and trigger the request.

```elixir
# lib/my_app/doc_server.ex
defmodule MyApp.DocServer do
  use GenServer

  # Constants
  @snapshot_threshold 50 # Ask for snapshot after 50 updates

  # State now tracks the count of updates since last snapshot
  defmodule State do
    defstruct [:history, :users, :update_count, :doc_id]
  end

  # ... start_link and init ...

  def init({doc_id}) do
    # Cleanup timer (e.g., 1 hour)
    Process.send_after(self(), :check_inactivity, 3_600_000)
    {:ok, %State{history: [], users: MapSet.new(), update_count: 0, doc_id: doc_id}}
  end

  # 1. Handle New User (Track PIDs for snapshotting)
  def handle_cast({:join, pid}, state) do
    {:noreply, %{state | users: MapSet.put(state.users, pid)}}
  end

  # 2. Handle User Leaving
  def handle_info({:DOWN, _ref, :process, pid, _reason}, state) do
    new_users = MapSet.delete(state.users, pid)
    # If empty, maybe set a shorter kill timer?
    {:noreply, %{state | users: new_users}}
  end

  # 3. Handle Update & Trigger Snapshot Logic
  def handle_cast({:add_update, binary}, state) do
    new_history = [binary | state.history]
    new_count = state.update_count + 1

    if new_count >= @snapshot_threshold do
      # TRIGGER SNAPSHOT
      trigger_snapshot_request(state.users)
      
      # Reset count, but keep history until we actually receive the snapshot
      {:noreply, %{state | history: new_history, update_count: 0}}
    else
      {:noreply, %{state | history: new_history, update_count: new_count}}
    end
  end

  # 4. Receive the Snapshot (The "Compression")
  def handle_cast({:save_snapshot, snapshot_binary}, state) do
    IO.puts("📦 Replacing #{length(state.history)} updates with 1 snapshot.")
    
    # DUMP old history. Replace with single snapshot blob.
    {:noreply, %{state | history: [snapshot_binary], update_count: 0}}
  end

  # --- Internal Helper ---
  defp trigger_snapshot_request(users) do
    # Pick a random user to do the work
    case Enum.random(users) do
      nil -> :ok # No users? Can't snapshot.
      pid -> send(pid, :request_snapshot) # Send message to the Channel process
    end
  end
end
```

### 2\. The Backend (Channel)

The Channel acts as the messenger. It receives the request from the GenServer and pushes it to the JS client.

```elixir
# lib/my_app_web/channels/doc_channel.ex
defmodule MyAppWeb.DocChannel do
  use MyAppWeb, :channel
  alias MyApp.DocServer

  def join("doc:" <> doc_id, _params, socket) do
    # Tell Server we exist (so it can ask us for snapshots later)
    GenServer.cast(via(doc_id), {:join, self()})
    
    # Monitor this channel process from the GenServer so it knows when we leave
    # (Implementation detail: The GenServer should monitor pids)

    # ... standard join logic (send history) ...
    {:ok, socket}
  end

  # 1. Listen for the Server's request
  def handle_info(:request_snapshot, socket) do
    push(socket, "request_snapshot", %{})
    {:noreply, socket}
  end

  # 2. Receive the Snapshot from Client
  def handle_in("snapshot", %{"body" => binary}, socket) do
    doc_id = socket.assigns.doc_id
    
    # Send to GenServer to overwrite history
    GenServer.cast(via(doc_id), {:save_snapshot, binary})
    
    {:reply, :ok, socket}
  end
  
  defp via(doc_id), do: {:via, Registry, {MyApp.DocRegistry, doc_id}}
end
```

### 3\. The Frontend (Update `PhoenixProvider.ts`)

We add a listener to handle the "request\_snapshot" event.

```typescript
// Inside PhoenixProvider constructor...

// LISTEN: Server is asking us to compress data
this.channel.on("request_snapshot", () => {
  console.log("📸 Server requested a snapshot. Compressing...");
  
  // 1. Encode the ENTIRE document state into one binary
  // This is the heavy lifting the server avoided doing.
  const snapshot = Y.encodeStateAsUpdate(this.doc);
  
  // 2. Send it back
  this.channel.push("snapshot", { body: Array.from(snapshot) });
});
```

### 4\. Why this is powerful

1.  **Server RAM:** instead of holding a list of 10,000 tiny byte arrays (`[header, insert 'a'], [header, insert 'b']...`), the server eventually holds **one** array representing the final text "ab".
2.  **Join Speed:** New users joining don't have to download and apply 10,000 operations. They download 1 snapshot.
3.  **Complexity:** Zero Rust dependencies on the server. You are just passing binaries around.

### 5\. Failure Case Handling

  * **What if the chosen client disconnects before sending the snapshot?**
      * Nothing breaks. The server just keeps the uncompressed history.
      * The `update_count` was reset to 0, so it will wait another 50 updates before trying again with a different client.
      * **Result:** The system is "eventually optimized" but always consistent.