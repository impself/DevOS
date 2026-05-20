import { useState, useEffect } from "react"
import { X, Trash2, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  updateTask, deleteTask, type Task, type UpdateTaskReq,
} from "@/api/task"
import { createComment, listComments, type Comment } from "@/api/comment"
import type { Member } from "@/api/project"

interface TaskDetailDrawerProps {
  task: Task
  projectId: string
  canEdit: boolean
  members: Member[]
  onClose: () => void
  onUpdated: () => void
  onDeleted: () => void
}

const statusOptions = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
  { value: "cancelled", label: "Cancelled" },
]

const priorityOptions = [
  { value: "high", label: "High" },
  { value: "medium", label: "Medium" },
  { value: "low", label: "Low" },
]

const typeOptions = [
  { value: "task", label: "Task" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "improvement", label: "Improvement" },
]

export default function TaskDetailDrawer({ task, projectId, canEdit, members, onClose, onUpdated, onDeleted }: TaskDetailDrawerProps) {
  const [title, setTitle] = useState(task.title)
  const [description, setDescription] = useState(task.description)
  const [status, setStatus] = useState(task.status)
  const [priority, setPriority] = useState(task.priority)
  const [type, setType] = useState(task.type)
  const [assigneeId, setAssigneeId] = useState(task.assignee_id || "")
  const [dueDate, setDueDate] = useState(task.due_date ? task.due_date.slice(0, 10) : "")
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  // Comments state
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [submittingComment, setSubmittingComment] = useState(false)

  useEffect(() => {
    setTitle(task.title)
    setDescription(task.description)
    setStatus(task.status)
    setPriority(task.priority)
    setType(task.type)
    setAssigneeId(task.assignee_id || "")
    setDueDate(task.due_date ? task.due_date.slice(0, 10) : "")
    setDirty(false)
    // Load comments
    listComments(projectId, task.id).then((res) => {
      if (res.code === 0) setComments(res.data || [])
    }).catch(() => {})
  }, [task.id, projectId])

  const markDirty = () => setDirty(true)

  const handleSave = async () => {
    if (!dirty) return
    setSaving(true)
    try {
      const updates: UpdateTaskReq = { title, description, status, priority, type }
      if (dueDate) updates.due_date = dueDate
      if (assigneeId) updates.assignee_id = assigneeId
      else updates.assignee_id = ""
      await updateTask(projectId, task.id, updates)
      setDirty(false)
      onUpdated()
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Delete this task?")) return
    try {
      await deleteTask(projectId, task.id)
      onDeleted()
      onClose()
    } catch {
      // silent
    }
  }

  const handleAddComment = async () => {
    if (!newComment.trim()) return
    setSubmittingComment(true)
    try {
      const res = await createComment(projectId, task.id, newComment.trim())
      if (res.code === 0) {
        setNewComment("")
        const listRes = await listComments(projectId, task.id)
        if (listRes.code === 0) setComments(listRes.data || [])
      }
    } catch {
      // silent
    } finally {
      setSubmittingComment(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div
        className="relative w-full max-w-lg bg-background border-l border-border flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-muted-foreground">TASK-{task.id.slice(0, 6).toUpperCase()}</span>
          <div className="flex items-center gap-2">
            {canEdit && dirty && (
              <Button size="sm" onClick={handleSave} disabled={saving} className="cursor-pointer">
                {saving ? "Saving..." : "Save"}
              </Button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                title="Delete task"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground cursor-pointer">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Title */}
          {canEdit ? (
            <Input
              value={title}
              onChange={(e) => { setTitle(e.target.value); markDirty() }}
              className="text-lg font-semibold border-0 px-0 shadow-none focus-visible:ring-0"
              placeholder="Task title"
            />
          ) : (
            <h2 className="text-lg font-semibold">{title}</h2>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
              {canEdit ? (
                <select value={status} onChange={(e) => { setStatus(e.target.value); markDirty() }} className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm cursor-pointer">
                  {statusOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <p className="text-sm capitalize">{status.replace("_", " ")}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Priority</label>
              {canEdit ? (
                <select value={priority} onChange={(e) => { setPriority(e.target.value); markDirty() }} className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm cursor-pointer">
                  {priorityOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <p className="text-sm capitalize">{priority}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Type</label>
              {canEdit ? (
                <select value={type} onChange={(e) => { setType(e.target.value); markDirty() }} className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm cursor-pointer">
                  {typeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : (
                <p className="text-sm capitalize">{type}</p>
              )}
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Due Date</label>
              {canEdit ? (
                <Input type="date" value={dueDate} onChange={(e) => { setDueDate(e.target.value); markDirty() }} className="h-8 text-sm" />
              ) : (
                <p className="text-sm">{dueDate || "Not set"}</p>
              )}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Assignee</label>
            {canEdit ? (
              <select
                value={assigneeId}
                onChange={(e) => { setAssigneeId(e.target.value); markDirty() }}
                className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm cursor-pointer"
              >
                <option value="">Unassigned</option>
                {members.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.nickname || m.username}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm">{task.assignee_nickname || task.assignee_name || "Unassigned"}</p>
            )}
          </div>

          {/* Creator */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Created by</label>
            <p className="text-sm">{task.creator_nickname || task.creator_name}</p>
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Description</label>
            {canEdit ? (
              <textarea
                value={description}
                onChange={(e) => { setDescription(e.target.value); markDirty() }}
                placeholder="Add a description..."
                rows={4}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{description || "No description"}</p>
            )}
          </div>

          {/* Comments section */}
          <div className="pt-3 border-t border-border">
            <label className="text-xs font-semibold text-muted-foreground mb-3 block">
              Comments ({comments.length})
            </label>

            {/* Comment list */}
            <div className="space-y-3 mb-3">
              {comments.map((c) => {
                const name = c.nickname || c.username
                const initial = (name || "?").charAt(0).toUpperCase()
                return (
                  <div key={c.id} className="flex gap-2.5">
                    {c.avatar ? (
                      <img src={c.avatar} alt={name} className="size-6 rounded-full object-cover mt-0.5 flex-shrink-0" />
                    ) : (
                      <div className="size-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary mt-0.5 flex-shrink-0">
                        {initial}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(c.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                      <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
                    </div>
                  </div>
                )
              })}
              {comments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-2">No comments yet</p>
              )}
            </div>

            {/* New comment input */}
            <div className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="h-8 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    handleAddComment()
                  }
                }}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleAddComment}
                disabled={!newComment.trim() || submittingComment}
                className="cursor-pointer flex-shrink-0"
              >
                <Send className="size-3.5" />
              </Button>
            </div>
          </div>

          {/* Timestamps */}
          <div className="pt-2 border-t border-border text-xs text-muted-foreground space-y-1">
            <p>Created: {new Date(task.created_at).toLocaleString()}</p>
            <p>Updated: {new Date(task.updated_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
