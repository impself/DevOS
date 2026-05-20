import { useState, useEffect, useMemo } from "react"
import { Search, X, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { listUsers, addMember, type UserItem, type Member } from "@/api/project"

interface MemberPickerProps {
  projectId: string
  existingMembers: Member[]
  onClose: () => void
  onAdded: () => void
}

// MemberPicker — select users from a searchable list and add them to the project in batch.
export default function MemberPicker({ projectId, existingMembers, onClose, onAdded }: MemberPickerProps) {
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [role, setRole] = useState("developer")
  const [submitting, setSubmitting] = useState(false)

  // existing member user IDs for exclusion
  const memberIds = useMemo(
    () => new Set(existingMembers.map((m) => m.user_id)),
    [existingMembers],
  )

  useEffect(() => {
    ;(async () => {
      try {
        const res = await listUsers()
        if (res.code === 0) setUsers(res.data || [])
      } catch {
        // silent
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  // filter: exclude existing members + match search term, sorted A-Z
  const filtered = useMemo(() => {
    const term = search.toLowerCase()
    return users
      .filter((u) => !memberIds.has(u.id))
      .filter(
        (u) =>
          u.username.toLowerCase().includes(term) ||
          u.email.toLowerCase().includes(term),
      )
      .sort((a, b) => a.username.localeCompare(b.username))
  }, [users, memberIds, search])

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((u) => u.id)))
    }
  }

  const handleSubmit = async () => {
    if (selected.size === 0) return
    setSubmitting(true)
    try {
      const names = filtered
        .filter((u) => selected.has(u.id))
        .map((u) => u.username)
      const results = await Promise.allSettled(
        names.map((username) => addMember(projectId, username, role)),
      )
      const failed = results.filter((r) => r.status === "rejected").length
      if (failed > 0) {
        // partial failure handled silently for now
      }
      onAdded()
      onClose()
    } catch {
      // silent
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-md bg-background border border-border rounded-lg shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold">Add Members</h3>
          <button type="button" onClick={onClose} className="p-1 rounded-md hover:bg-muted text-muted-foreground cursor-pointer">
            <X className="size-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or email..."
              className="h-8 pl-8 text-sm"
            />
          </div>
        </div>

        {/* User list */}
        <div className="max-h-64 overflow-y-auto">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading users...</div>
          ) : filtered.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {users.length === 0 ? "No users found" : "All users are already members"}
            </div>
          ) : (
            <>
              {/* Select all row */}
              <label className="flex items-center gap-3 px-4 py-2 border-b border-border bg-muted/30 cursor-pointer hover:bg-muted/50">
                <Checkbox
                  checked={selected.size === filtered.length && filtered.length > 0}
                  onCheckedChange={toggleAll}
                />
                <span className="text-xs text-muted-foreground">
                  Select all ({filtered.length} available)
                </span>
              </label>
              {filtered.map((u) => (
                <label
                  key={u.id}
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={selected.has(u.id)}
                    onCheckedChange={() => toggle(u.id)}
                  />
                  <div className="size-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    {u.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.username}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                </label>
              ))}
            </>
          )}
        </div>

        {/* Footer: role selector + submit */}
        <div className="flex items-center gap-3 px-4 py-3 border-t border-border">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="developer">Developer</option>
            <option value="viewer">Viewer</option>
          </select>
          <div className="flex-1" />
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={selected.size === 0 || submitting}
            className="cursor-pointer"
          >
            <UserPlus className="size-3.5 mr-1" />
            {submitting
              ? "Adding..."
              : `Add ${selected.size > 0 ? selected.size : ""} Member${selected.size > 1 ? "s" : ""}`}
          </Button>
        </div>
      </div>
    </div>
  )
}
