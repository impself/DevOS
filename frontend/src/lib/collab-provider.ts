import * as Y from "yjs"
import { Awareness, encodeAwarenessUpdate, applyAwarenessUpdate } from "y-protocols/awareness"

// Message type prefix bytes — must match server internal/collab/client.go
const MSG_UPDATE = 0
const MSG_AWARENESS = 1
const MSG_SYNC_STATE = 2

const RECONNECT_DELAY = 2000
const STATE_SYNC_INTERVAL = 30_000

/**
 * CollabProvider — lightweight WebSocket provider for Yjs collaborative editing.
 * Connects to Go server (dumb relay), handles binary Yjs + Awareness sync.
 */
export class CollabProvider {
  doc: Y.Doc
  awareness: Awareness
  url: string
  ws: WebSocket | null = null
  connected = false
  synced = false

  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private stateSyncTimer: ReturnType<typeof setInterval> | null = null
  private destroyed = false

  constructor(url: string, doc: Y.Doc, awareness: Awareness) {
    this.url = url
    this.doc = doc
    this.awareness = awareness
  }

  connect(): void {
    if (this.destroyed) return
    this.ws = new WebSocket(this.url)
    this.ws.binaryType = "arraybuffer"

    this.ws.onopen = () => {
      this.connected = true
    }

    this.ws.onmessage = (event: MessageEvent) => {
      const data = new Uint8Array(event.data as ArrayBuffer)
      if (data.length < 1) return

      const msgType = data[0]
      const payload = data.slice(1)

      switch (msgType) {
        case MSG_UPDATE:
          Y.applyUpdate(this.doc, payload)
          break

        case MSG_SYNC_STATE:
          // Server sent stored Yjs state — apply and mark as synced
          if (payload.length > 0) {
            Y.applyUpdate(this.doc, payload)
          }
          this.synced = true
          break

        case MSG_AWARENESS:
          applyAwarenessUpdate(this.awareness, payload, "external")
          break
      }
    }

    this.ws.onclose = () => {
      this.connected = false
      this.scheduleReconnect()
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }

    // Listen for local Yjs updates → send to server
    this.doc.on("update", this.handleDocUpdate)

    // Listen for local awareness changes → send to server
    this.awareness.on("update", this.handleAwarenessUpdate)

    // Periodically send full state snapshot for server persistence
    this.stateSyncTimer = setInterval(() => this.sendFullState(), STATE_SYNC_INTERVAL)
  }

  disconnect(): void {
    this.doc.off("update", this.handleDocUpdate)
    this.awareness.off("update", this.handleAwarenessUpdate)

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.stateSyncTimer) {
      clearInterval(this.stateSyncTimer)
      this.stateSyncTimer = null
    }

    // Send final full state before disconnecting
    this.sendFullState()

    if (this.ws) {
      this.ws.onclose = null
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  destroy(): void {
    this.destroyed = true
    this.disconnect()
  }

  private handleDocUpdate = (update: Uint8Array, origin: unknown): void => {
    if (origin === "external" || !this.connected) return
    this.send(MSG_UPDATE, update)
  }

  private handleAwarenessUpdate = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }, origin: unknown): void => {
    if (origin === "external" || !this.connected) return
    const changedClients = added.concat(updated, removed)
    if (changedClients.length === 0) return
    const awarenessUpdate = encodeAwarenessUpdate(this.awareness, changedClients)
    this.send(MSG_AWARENESS, awarenessUpdate)
  }

  private sendFullState(): void {
    if (!this.connected) return
    const fullState = Y.encodeStateAsUpdate(this.doc)
    if (fullState.length > 0) {
      this.send(MSG_SYNC_STATE, fullState)
    }
  }

  private send(msgType: number, payload: Uint8Array): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    const msg = new Uint8Array(1 + payload.length)
    msg[0] = msgType
    msg.set(payload, 1)
    this.ws.send(msg)
  }

  private scheduleReconnect(): void {
    if (this.destroyed) return
    this.reconnectTimer = setTimeout(() => {
      this.connect()
    }, RECONNECT_DELAY)
  }
}
