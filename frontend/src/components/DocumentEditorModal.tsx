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
import { useAuth } from "@/context/AuthContext"
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
  const { user } = useAuth()
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
  const [collabProvider, setCollabProvider] = useState<CollabProvider | null>(null)

  // Load document content + init collaborative editing
  useEffect(() => {
    let cancelled = false
    const doc = new Y.Doc()
    const awareness = new Awareness(doc)
    awarenessRef.current = awareness

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

      if (cancelled) return

      // Initialize collaborative editing
      const token = sessionStorage.getItem("access_token")
      if (token) {
        const wsUrl = `ws://localhost:8080/api/v1/projects/${projectId}/collab/${document.id}?token=${token}`
        const prov = new CollabProvider(wsUrl, doc, awareness)
        prov.connect()

        // Wait for server state sync, then expose Yjs to editor
        setTimeout(() => {
          if (!cancelled) {
            setYdoc(doc)
            setCollabProvider(prov)
            setLoading(false)
          }
        }, 1200)
      } else {
        // No token — standalone mode
        setLoading(false)
      }
    }

    init()

    // Track online users via awareness
    awareness.on("change", () => {
      if (!cancelled) {
        setOnlineUsers(awareness.getStates().size)
      }
    })

    return () => {
      cancelled = true
      if (collabProvider) {
        collabProvider.destroy()
      }
      doc.destroy()
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
              provider={collabProvider}
              userName={user?.nickname || user?.username || "Anonymous"}
            />
          </div>
        )}
      </div>
    </div>
  )
}
