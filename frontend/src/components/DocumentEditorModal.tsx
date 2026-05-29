import { useState, useEffect, useRef, useCallback } from "react"
import { X, Save, Loader2, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import * as Y from "yjs"
import { Awareness } from "y-protocols/awareness"
import DocumentEditor from "./DocumentEditor"
import { CollabProvider } from "@/lib/collab-provider"
import { getDocument, updateDocument, type Document } from "@/api/document"
import { useToast } from "@/context/ToastContext"
import "./CollabCursors.css"

interface DocumentEditorModalProps {
  document: Document
  projectId: string
  canEdit: boolean
  onClose: () => void
  onUpdated: () => void
}

export default function DocumentEditorModal({ document, projectId, canEdit, onClose, onUpdated }: DocumentEditorModalProps) {
  const { toast } = useToast()
  const [title, setTitle] = useState(document.title)
  const [content, setContent] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState<number>(0)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const awarenessRef = useRef<Awareness | null>(null)

  // Yjs state — stored in state so DocumentEditor can consume during render
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null)

  // Load document content + init collaborative editing
  useEffect(() => {
    let cancelled = false
    let prov: CollabProvider | null = null

    const init = async () => {
      // Load full document from REST API
      try {
        const res = await getDocument(projectId, document.id)
        if (!cancelled && res.code === 0 && res.data) {
          setTitle(res.data.title)
          setContent(res.data.content || null)
        }
      } catch {
        toast.error("Failed to load document")
      }

      if (cancelled) { setLoading(false); return }

      // Try collaborative editing — fallback to standalone on error
      try {
        const token = sessionStorage.getItem("access_token")
        if (token) {
          const doc = new Y.Doc()
          const awareness = new Awareness(doc)
          awarenessRef.current = awareness

          const wsUrl = `ws://localhost:8080/api/v1/projects/${projectId}/collab/${document.id}?token=${token}`
          prov = new CollabProvider(wsUrl, doc, awareness)
          prov.connect()

          // Track online users via awareness
          awareness.on("change", () => {
            if (!cancelled) {
              setOnlineUsers(awareness.getStates().size)
            }
          })

          // Wait for WebSocket to actually connect before exposing Yjs to editor.
          // If collab fails, ydoc stays null → editor uses standalone mode with content prop.
          const connected = await new Promise<boolean>((resolve) => {
            const checkInterval = setInterval(() => {
              if (prov!.connected) {
                clearInterval(checkInterval)
                resolve(true)
              }
            }, 100)
            setTimeout(() => {
              clearInterval(checkInterval)
              resolve(false)
            }, 5000)
          })

          if (!cancelled && connected) {
            setYdoc(doc)
          } else {
            // Collab didn't connect — cleanup, fall back to standalone
            if (prov) { prov.destroy(); prov = null }
          }
        }
      } catch {
        // Collab failed — fall through to standalone mode
        prov = null
      }

      if (!cancelled) setLoading(false)
    }

    init()

    return () => {
      cancelled = true
      if (prov) prov.destroy()
      if (awarenessRef.current) {
        try { awarenessRef.current.doc?.destroy() } catch { /* noop */ }
      }
      awarenessRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, document.id, toast])

  const handleContentUpdate = useCallback((newContent: Record<string, unknown>) => {
    setContent(newContent)
    setDirty(true)
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const res = await updateDocument(projectId, document.id, {
        title: title || undefined,
        content: content || undefined,
      })
      if (res.code === 0) {
        setDirty(false)
        toast.success("Document saved")
        onUpdated()
      }
    } catch {
      toast.error("Failed to save document")
    } finally {
      setSaving(false)
    }
  }, [projectId, document.id, title, content, toast, onUpdated])

  // Auto-save with debounce (1.5s)
  useEffect(() => {
    if (!dirty || loading) return
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      handleSave()
    }, 1500)
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [content, dirty, loading, handleSave])

  const handleClose = () => {
    if (dirty) handleSave()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30">
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true) }}
          className="h-8 text-sm font-medium border-0 bg-transparent focus-visible:ring-1 max-w-md"
          disabled={!canEdit || loading}
        />
        <div className="flex items-center gap-2 ml-auto">
          {onlineUsers > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Users className="size-3" />
              {onlineUsers}
            </span>
          )}
          {dirty && <span className="text-[10px] text-muted-foreground">Unsaved</span>}
          {saving && <span className="text-[10px] text-muted-foreground">Saving...</span>}
          {canEdit && (
            <Button variant="outline" size="sm" onClick={handleSave} disabled={saving || !dirty} className="cursor-pointer">
              <Save className="size-3.5 mr-1" />
              Save
            </Button>
          )}
          <button type="button" onClick={handleClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="size-5 animate-spin mr-2" />
            <span className="text-sm">Loading document...</span>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto py-4 px-2">
            <DocumentEditor
              content={content}
              onUpdate={handleContentUpdate}
              editable={canEdit}
              ydoc={ydoc}
            />
          </div>
        )}
      </div>
    </div>
  )
}
