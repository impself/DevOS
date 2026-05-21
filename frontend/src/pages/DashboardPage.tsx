import { useState, useEffect, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { Plus, Trash2, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/context/ToastContext"
import { listProjects, createProject, deleteProject, type Project } from "@/api/project"
import { SkeletonCard } from "@/components/ui/skeleton"
import ShowcaseCard from "@/components/showcase/Card"

// DashboardPage — shows project list with create/delete actions
export default function DashboardPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === "admin"
  const navigate = useNavigate()
  const { toast } = useToast()
  const [projects, setProjects] = useState<Project[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)

  // Create project modal state
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState("")
  const [newDesc, setNewDesc] = useState("")
  const [creating, setCreating] = useState(false)

  // Fetch project list from backend
  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listProjects()
      if (res.code === 0) {
        setProjects(res.data || [])
        setTotal(res.pagination?.total || 0)
      }
    } catch {
      toast.error("Failed to load projects")
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchProjects() }, [fetchProjects])

  // Handle create project
  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    try {
      await createProject(newName, newDesc)
      setShowCreate(false)
      setNewName("")
      setNewDesc("")
      toast.success("Project created")
      fetchProjects()
    } catch {
      toast.error("Failed to create project")
    } finally {
      setCreating(false)
    }
  }

  // Handle delete project
  const handleDelete = async (id: string) => {
    if (!confirm("Delete this project? This cannot be undone.")) return
    try {
      await deleteProject(id)
      toast.success("Project deleted")
      fetchProjects()
    } catch {
      toast.error("Failed to delete project")
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">{total} project{total !== 1 ? "s" : ""}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(true)} className="cursor-pointer">
            <Plus className="size-4 mr-1" />
            New Project
          </Button>
        )}
      </div>

      {/* Create project modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">Create Project</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="proj-name">Name</Label>
                <Input
                  id="proj-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="My awesome project"
                  required
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="proj-desc">Description</Label>
                <Input
                  id="proj-desc"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Brief description..."
                />
              </div>
              <div className="flex gap-3 justify-end">
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)} className="cursor-pointer">
                  Cancel
                </Button>
                <Button type="submit" disabled={creating} className="cursor-pointer">
                  {creating ? "Creating..." : "Create"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project list */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderEmpty className="size-12 mx-auto text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground">No projects yet. Create your first one!</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ShowcaseCard
              key={p.id}
              title={p.name}
              description={p.description || "No description"}
              meta={new Date(p.created_at).toLocaleDateString()}
              progress={
                p.task_total != null && p.task_total > 0
                  ? { done: p.task_done ?? 0, total: p.task_total }
                  : undefined
              }
              onClick={() => navigate(`/projects/${p.id}`)}
              actions={
                <>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); navigate(`/projects/${p.id}`); }}
                    className="action-btn"
                    title="Open"
                  >
                    <ExternalLink className="size-3.5" />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id); }}
                      className="action-btn danger"
                      title="Delete"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Empty state icon
function FolderEmpty({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}
