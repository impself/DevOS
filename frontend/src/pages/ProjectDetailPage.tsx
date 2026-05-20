import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil, UserPlus, Trash2, Plus, CircleDot, Search, LayoutGrid, List } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import {
  getProject, updateProject, listMembers, removeMember, updateMemberRole,
  type Project, type Member,
} from "@/api/project"
import {
  listTasks, createTask, updateTask, deleteTask,
  type Task, type CreateTaskReq, type TaskFilters,
} from "@/api/task"
import MemberPicker from "@/components/MemberPicker"
import TaskKanban from "@/components/TaskKanban"
import TaskDetailDrawer from "@/components/TaskDetailDrawer"

// Priority badge color map
const priorityConfig: Record<string, { label: string; cls: string }> = {
  high: { label: "High", cls: "bg-red-500/10 text-red-600" },
  medium: { label: "Medium", cls: "bg-yellow-500/10 text-yellow-600" },
  low: { label: "Low", cls: "bg-blue-500/10 text-blue-600" },
}

// Status badge color map
const statusConfig: Record<string, { label: string; cls: string }> = {
  backlog: { label: "Backlog", cls: "bg-muted text-muted-foreground" },
  todo: { label: "To Do", cls: "bg-blue-500/10 text-blue-600" },
  in_progress: { label: "In Progress", cls: "bg-yellow-500/10 text-yellow-600" },
  in_review: { label: "In Review", cls: "bg-purple-500/10 text-purple-600" },
  done: { label: "Done", cls: "bg-green-500/10 text-green-600" },
  cancelled: { label: "Cancelled", cls: "bg-muted text-muted-foreground line-through" },
}

// Type badge
const typeConfig: Record<string, { label: string; cls: string }> = {
  task: { label: "Task", cls: "bg-primary/10 text-primary" },
  bug: { label: "Bug", cls: "bg-red-500/10 text-red-600" },
  feature: { label: "Feature", cls: "bg-blue-500/10 text-blue-600" },
  improvement: { label: "Improvement", cls: "bg-green-500/10 text-green-600" },
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTotal, setTaskTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  const isAdmin = user?.role === "admin"
  const canEdit = isAdmin
  const canManageMembers = isAdmin

  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [saving, setSaving] = useState(false)

  // Add member state
  const [showMemberPicker, setShowMemberPicker] = useState(false)

  // Task state
  const [showCreateTask, setShowCreateTask] = useState(false)
  const [newTask, setNewTask] = useState<CreateTaskReq>({ title: "" })
  const [taskSearch, setTaskSearch] = useState("")
  const [taskFilter, setTaskFilter] = useState<TaskFilters>({})
  const [taskPage, setTaskPage] = useState(1)
  const [creatingTask, setCreatingTask] = useState(false)
  const [viewMode, setViewMode] = useState<"list" | "kanban">("list")
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)

  // Fetch project detail and member list
  const fetchData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [projRes, memRes] = await Promise.all([getProject(id), listMembers(id)])
      if (projRes.code === 0) {
        setProject(projRes.data)
        setEditName(projRes.data.name)
        setEditDesc(projRes.data.description)
      }
      if (memRes.code === 0) setMembers(memRes.data || [])
    } catch {
      // 401 handled by interceptor
    } finally {
      setLoading(false)
    }
  }, [id])

  // Fetch tasks with current filters
  const fetchTasks = useCallback(async () => {
    if (!id) return
    try {
      const res = await listTasks(id, {
        ...taskFilter,
        search: taskSearch || undefined,
        page: taskPage,
        page_size: 20,
      })
      if (res.code === 0) {
        setTasks(res.data || [])
        setTaskTotal(res.pagination?.total || 0)
      }
    } catch {
      // silent
    }
  }, [id, taskFilter, taskSearch, taskPage])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { fetchTasks() }, [fetchTasks])

  // Handle save edits
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setSaving(true)
    try {
      const res = await updateProject(id, editName, editDesc)
      if (res.code === 0) {
        setProject(res.data)
        setEditing(false)
      }
    } catch {
      // silent
    } finally {
      setSaving(false)
    }
  }

  // Handle role change
  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!id) return
    try {
      const res = await updateMemberRole(id, userId, newRole)
      if (res.code === 0) fetchData()
    } catch {
      // silent
    }
  }

  // Handle remove member
  const handleRemoveMember = async (userId: string) => {
    if (!id) return
    if (!confirm("Remove this member?")) return
    try {
      await removeMember(id, userId)
      fetchData()
    } catch {
      // silent
    }
  }

  // Handle create task
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !newTask.title.trim()) return
    setCreatingTask(true)
    try {
      const res = await createTask(id, newTask)
      if (res.code === 0) {
        setShowCreateTask(false)
        setNewTask({ title: "" })
        fetchTasks()
      }
    } catch {
      // silent
    } finally {
      setCreatingTask(false)
    }
  }

  // Handle task status change
  const handleStatusChange = async (taskId: string, status: string) => {
    if (!id) return
    try {
      await updateTask(id, taskId, { status })
      fetchTasks()
    } catch {
      // silent
    }
  }

  // Handle delete task
  const handleDeleteTask = async (taskId: string) => {
    if (!id) return
    if (!confirm("Delete this task?")) return
    try {
      await deleteTask(id, taskId)
      fetchTasks()
    } catch {
      // silent
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-muted-foreground mb-4">Project not found</p>
        <Button variant="outline" onClick={() => navigate("/dashboard")} className="cursor-pointer">Back to Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Back button */}
      <button
        type="button"
        onClick={() => navigate("/dashboard")}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 cursor-pointer"
      >
        <ArrowLeft className="size-4" />
        Back to projects
      </button>

      {/* Project info section */}
      <div className="border border-border rounded-lg p-6 mb-6">
        {editing ? (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Project Name</Label>
              <Input id="edit-name" value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-desc">Description</Label>
              <Input id="edit-desc" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <Button type="submit" disabled={saving} className="cursor-pointer">{saving ? "Saving..." : "Save"}</Button>
              <Button type="button" variant="outline" onClick={() => setEditing(false)} className="cursor-pointer">Cancel</Button>
            </div>
          </form>
        ) : (
          <div>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-xl font-bold">{project.name}</h1>
                <p className="text-muted-foreground text-sm mt-1">{project.description || "No description"}</p>
              </div>
              {canEdit && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="cursor-pointer">
                  <Pencil className="size-3.5 mr-1" />
                  Edit
                </Button>
              )}
            </div>
            <div className="mt-4 flex gap-4 text-xs text-muted-foreground">
              <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
              <span>Workspace: {project.workspace_id.slice(0, 8)}...</span>
            </div>
          </div>
        )}
      </div>

      {/* Tasks section */}
      <div className="border border-border rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Tasks ({taskTotal})</h2>
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                value={taskSearch}
                onChange={(e) => { setTaskSearch(e.target.value); setTaskPage(1) }}
                placeholder="Search tasks..."
                className="h-8 w-48 pl-8 text-sm"
              />
            </div>
            {/* Status filter */}
            <select
              value={taskFilter.status || ""}
              onChange={(e) => setTaskFilter((f) => ({ ...f, status: e.target.value || undefined }))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs cursor-pointer"
            >
              <option value="">All Status</option>
              <option value="backlog">Backlog</option>
              <option value="todo">To Do</option>
              <option value="in_progress">In Progress</option>
              <option value="in_review">In Review</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
            {/* Priority filter */}
            <select
              value={taskFilter.priority || ""}
              onChange={(e) => setTaskFilter((f) => ({ ...f, priority: e.target.value || undefined }))}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs cursor-pointer"
            >
              <option value="">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            {canEdit && (
              <Button variant="outline" size="sm" onClick={() => setShowCreateTask(true)} className="cursor-pointer">
                <Plus className="size-3.5 mr-1" />
                New Task
              </Button>
            )}
            {/* View toggle */}
            <div className="flex border border-border rounded-md overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1.5 cursor-pointer transition-colors ${viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                title="List view"
              >
                <List className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={`p-1.5 cursor-pointer transition-colors ${viewMode === "kanban" ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
                title="Kanban view"
              >
                <LayoutGrid className="size-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Create task form */}
        {showCreateTask && (
          <form onSubmit={handleCreateTask} className="mb-4 p-4 border border-border rounded-md bg-muted/30 space-y-3">
            <Input
              value={newTask.title}
              onChange={(e) => setNewTask((t) => ({ ...t, title: e.target.value }))}
              placeholder="Task title"
              required
              className="h-9 text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <select
                value={newTask.type || "task"}
                onChange={(e) => setNewTask((t) => ({ ...t, type: e.target.value }))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="task">Task</option>
                <option value="bug">Bug</option>
                <option value="feature">Feature</option>
                <option value="improvement">Improvement</option>
              </select>
              <select
                value={newTask.priority || "medium"}
                onChange={(e) => setNewTask((t) => ({ ...t, priority: e.target.value }))}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              >
                <option value="medium">Medium</option>
                <option value="low">Low</option>
                <option value="high">High</option>
              </select>
              <div className="flex-1" />
              <Button type="submit" size="sm" disabled={creatingTask} className="cursor-pointer">
                {creatingTask ? "Creating..." : "Create"}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => { setShowCreateTask(false); setNewTask({ title: "" }) }} className="cursor-pointer">
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Task view */}
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CircleDot className="size-8 mb-2 opacity-40" />
            <p className="text-sm">No tasks yet. Create one to get started.</p>
          </div>
        ) : viewMode === "kanban" ? (
          <TaskKanban
            tasks={tasks}
            projectId={id!}
            canEdit={canEdit}
            onTaskClick={(t) => setSelectedTask(t)}
            onRefresh={fetchTasks}
          />
        ) : (
          <div className="divide-y divide-border">
            {tasks.map((t) => {
              const sc = statusConfig[t.status] || statusConfig.todo
              const pc = priorityConfig[t.priority] || priorityConfig.medium
              const tc = typeConfig[t.type] || typeConfig.task
              return (
                <div
                  key={t.id}
                  className="flex items-center gap-3 py-3 group cursor-pointer hover:bg-muted/30 transition-colors rounded px-1"
                  onClick={() => setSelectedTask(t)}
                >
                  {/* Status select */}
                  <select
                    value={t.status}
                    onChange={(e) => { e.stopPropagation(); handleStatusChange(t.id, e.target.value) }}
                    onClick={(e) => e.stopPropagation()}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium border-0 cursor-pointer ${sc.cls}`}
                  >
                    <option value="backlog">Backlog</option>
                    <option value="todo">To Do</option>
                    <option value="in_progress">In Progress</option>
                    <option value="in_review">In Review</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>

                  {/* Task info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tc.cls}`}>{tc.label}</span>
                      <span className="text-sm font-medium truncate">{t.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${pc.cls}`}>{pc.label}</span>
                      {t.assignee_name && (
                        <span className="text-[10px] text-muted-foreground">{t.assignee_name}</span>
                      )}
                      {t.due_date && (
                        <span className="text-[10px] text-muted-foreground">
                          Due {new Date(t.due_date).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.id) }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all cursor-pointer"
                      title="Delete task"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Pagination (list mode only) */}
        {viewMode === "list" && taskTotal > 20 && (
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
            <Button variant="outline" size="sm" disabled={taskPage <= 1} onClick={() => setTaskPage((p) => p - 1)} className="cursor-pointer">
              Prev
            </Button>
            <span>Page {taskPage}</span>
            <Button variant="outline" size="sm" disabled={taskPage * 20 >= taskTotal} onClick={() => setTaskPage((p) => p + 1)} className="cursor-pointer">
              Next
            </Button>
          </div>
        )}
      </div>

      {/* Members section */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Members ({members.length})</h2>
          {canManageMembers && (
            <Button variant="outline" size="sm" onClick={() => setShowMemberPicker(true)} className="cursor-pointer">
              <UserPlus className="size-3.5 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Member list */}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No members found</p>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => {
              const displayName = m.nickname || m.username
              const initial = (displayName || "?").charAt(0).toUpperCase()
              return (
                <div key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {m.avatar ? (
                      <img src={m.avatar} alt={displayName} className="size-8 rounded-full object-cover" />
                    ) : (
                      <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {initial}
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">{displayName}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === "owner" ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">Owner</span>
                    ) : canManageMembers ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.user_id, e.target.value)}
                        className="h-7 rounded-md border border-input bg-background px-2 text-xs cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        <option value="developer">Developer</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    ) : (
                      <span className="text-xs text-muted-foreground capitalize">{m.role}</span>
                    )}
                    {canManageMembers && m.role !== "owner" && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.user_id)}
                        className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                        title="Remove member"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Member picker modal */}
      {showMemberPicker && id && (
        <MemberPicker
          projectId={id}
          existingMembers={members}
          onClose={() => setShowMemberPicker(false)}
          onAdded={fetchData}
        />
      )}

      {/* Task detail drawer */}
      {selectedTask && id && (
        <TaskDetailDrawer
          task={selectedTask}
          projectId={id}
          canEdit={canEdit}
          onClose={() => setSelectedTask(null)}
          onUpdated={fetchTasks}
          onDeleted={fetchTasks}
        />
      )}
    </div>
  )
}
