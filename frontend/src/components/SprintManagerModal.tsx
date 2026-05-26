import { useState, useEffect } from "react"
import { X, Plus, Play, CheckCircle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { listSprints, createSprint, updateSprint, deleteSprint, type Sprint } from "@/api/sprint"
import { useToast } from "@/context/ToastContext"

interface SprintManagerModalProps {
  projectId: string
  onClose: () => void
  onSprintChange: () => void
}

const statusLabel: Record<string, { label: string; cls: string }> = {
  planning: { label: "Planning", cls: "bg-muted text-muted-foreground" },
  active: { label: "Active", cls: "bg-green-500/10 text-green-600" },
  completed: { label: "Completed", cls: "bg-blue-500/10 text-blue-600" },
}

export default function SprintManagerModal({ projectId, onClose, onSprintChange }: SprintManagerModalProps) {
  const { toast } = useToast()
  const [sprints, setSprints] = useState<Sprint[]>([])
  const [taskCounts, setTaskCounts] = useState<Record<string, number>>({})
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState("")
  const [goal, setGoal] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const fetchSprints = async () => {
    try {
      const res = await listSprints(projectId)
      if (res.code === 0) {
        setSprints(res.data.sprints || [])
        setTaskCounts(res.data.task_counts || {})
      }
    } catch {
      toast.error("Failed to load sprints")
    }
  }

  useEffect(() => { fetchSprints() }, [projectId])

  const handleCreate = async () => {
    if (!name.trim() || !startDate || !endDate) return
    setSubmitting(true)
    try {
      const res = await createSprint(projectId, {
        name: name.trim(),
        goal: goal.trim() || undefined,
        start_date: startDate,
        end_date: endDate,
      })
      if (res.code === 0) {
        toast.success("Sprint created")
        setName("")
        setGoal("")
        setStartDate("")
        setEndDate("")
        setShowForm(false)
        fetchSprints()
        onSprintChange()
      }
    } catch {
      toast.error("Failed to create sprint")
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (sprintId: string, status: string) => {
    try {
      const res = await updateSprint(projectId, sprintId, { status })
      if (res.code === 0) {
        toast.success(`Sprint ${status}`)
        fetchSprints()
        onSprintChange()
      }
    } catch {
      toast.error("Failed to update sprint")
    }
  }

  const handleDelete = async (sprintId: string) => {
    if (!confirm("Delete this sprint? Tasks will be unassigned.")) return
    try {
      const res = await deleteSprint(projectId, sprintId)
      if (res.code === 0) {
        toast.success("Sprint deleted")
        fetchSprints()
        onSprintChange()
      }
    } catch {
      toast.error("Failed to delete sprint")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-2xl bg-background border border-border rounded-xl shadow-lg max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold">Sprints</h2>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowForm(!showForm)} className="cursor-pointer">
              <Plus className="size-3.5 mr-1" />
              New Sprint
            </Button>
            <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground cursor-pointer">
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div className="p-4 border-b border-border bg-muted/20 space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Sprint name" className="h-9" />
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Sprint goal (optional)" className="h-9" />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-9 text-sm" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowForm(false)} className="cursor-pointer">Cancel</Button>
              <Button size="sm" onClick={handleCreate} disabled={submitting || !name.trim() || !startDate || !endDate} className="cursor-pointer">
                {submitting ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        )}

        {/* Sprint list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sprints.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <p className="text-sm">No sprints yet. Create one to plan your iterations.</p>
            </div>
          ) : (
            sprints.map((s) => {
              const sc = statusLabel[s.status] || statusLabel.planning
              const taskCount = taskCounts[s.id] || 0
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/20 transition-colors">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${sc.cls}`}>{sc.label}</span>
                    </div>
                    {s.goal && <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.goal}</p>}
                    <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                      <span>{new Date(s.start_date).toLocaleDateString()} → {new Date(s.end_date).toLocaleDateString()}</span>
                      <span>{taskCount} task{taskCount !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {s.status === "planning" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(s.id, "active")}
                        className="p-1.5 rounded-md hover:bg-green-500/10 text-muted-foreground hover:text-green-600 transition-colors cursor-pointer"
                        title="Start Sprint"
                      >
                        <Play className="size-3.5" />
                      </button>
                    )}
                    {s.status === "active" && (
                      <button
                        type="button"
                        onClick={() => handleStatusChange(s.id, "completed")}
                        className="p-1.5 rounded-md hover:bg-blue-500/10 text-muted-foreground hover:text-blue-600 transition-colors cursor-pointer"
                        title="Complete Sprint"
                      >
                        <CheckCircle className="size-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
                      title="Delete Sprint"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
