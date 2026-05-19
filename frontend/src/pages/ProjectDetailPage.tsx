import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { ArrowLeft, Pencil, UserPlus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/context/AuthContext"
import {
  getProject, updateProject, listMembers, addMember, removeMember,
  type Project, type Member,
} from "@/api/project"

// ProjectDetailPage — view/edit project info + manage members
export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [project, setProject] = useState<Project | null>(null)
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)

  // 权限计算：仅系统管理员有写权限，普通用户只读
  const isAdmin = user?.role === "admin"
  const canEdit = isAdmin
  const canManageMembers = isAdmin

  // Edit mode state
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState("")
  const [editDesc, setEditDesc] = useState("")
  const [saving, setSaving] = useState(false)

  // Add member state
  const [showAddMember, setShowAddMember] = useState(false)
  const [memberUsername, setMemberUsername] = useState("")
  const [memberRole, setMemberRole] = useState("developer")
  const [addingMember, setAddingMember] = useState(false)

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

  useEffect(() => { fetchData() }, [fetchData])

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

  // Handle add member
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id) return
    setAddingMember(true)
    try {
      const res = await addMember(id, memberUsername, memberRole)
      if (res.code === 0) {
        setShowAddMember(false)
        setMemberUsername("")
        setMemberRole("developer")
        fetchData()
      }
    } catch {
      // silent
    } finally {
      setAddingMember(false)
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
    <div className="p-6 lg:p-8 max-w-3xl mx-auto">
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

      {/* Members section */}
      <div className="border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Members ({members.length})</h2>
          {canManageMembers && (
            <Button variant="outline" size="sm" onClick={() => setShowAddMember(true)} className="cursor-pointer">
              <UserPlus className="size-3.5 mr-1" />
              Add
            </Button>
          )}
        </div>

        {/* Add member modal */}
        {showAddMember && (
          <div className="mb-4 p-4 border border-border rounded-md bg-muted/30">
            <form onSubmit={handleAddMember} className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="member-uid" className="text-xs">Username</Label>
                <Input
                  id="member-uid"
                  value={memberUsername}
                  onChange={(e) => setMemberUsername(e.target.value)}
                  placeholder="Enter username"
                  required
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="member-role" className="text-xs">Role</Label>
                <select
                  id="member-role"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="developer">Developer</option>
                  <option value="viewer">Viewer</option>
                </select>
              </div>
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={addingMember} className="cursor-pointer">
                  {addingMember ? "Adding..." : "Add Member"}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setShowAddMember(false)} className="cursor-pointer">
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Member list */}
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No members found</p>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {(m.username || "?").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.username}</p>
                    <p className="text-xs text-muted-foreground">{m.role} &middot; {m.email}</p>
                  </div>
                </div>
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
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
