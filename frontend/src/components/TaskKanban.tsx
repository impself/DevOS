import { useState } from "react"
import {
  DndContext, DragOverlay, closestCorners,
  PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core"
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable"

import { updateTask, type Task } from "@/api/task"
import { useToast } from "@/context/ToastContext"
import SortableTaskCard from "./SortableTaskCard"

const columns = [
  { id: "backlog", label: "Backlog", color: "bg-muted" },
  { id: "todo", label: "To Do", color: "bg-blue-500" },
  { id: "in_progress", label: "In Progress", color: "bg-yellow-500" },
  { id: "in_review", label: "In Review", color: "bg-purple-500" },
  { id: "done", label: "Done", color: "bg-green-500" },
]

const priorityDot: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
}

const typeLabel: Record<string, string> = {
  task: "T", bug: "B", feature: "F", improvement: "I",
}

interface TaskKanbanProps {
  tasks: Task[]
  projectId: string
  canEdit: boolean
  onTaskClick: (task: Task) => void
  onRefresh: () => void
}

export default function TaskKanban({ tasks, projectId, canEdit, onTaskClick, onRefresh }: TaskKanbanProps) {
  const { toast } = useToast()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeTask, setActiveTask] = useState<Task | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  const tasksByStatus = (status: string) => tasks.filter((t) => t.status === status)

  const handleDragStart = (event: DragStartEvent) => {
    const id = String(event.active.id)
    setActiveId(id)
    setActiveTask(tasks.find((t) => t.id === id) || null)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    setActiveTask(null)
    const { active, over } = event
    if (!over || !canEdit) return

    const taskId = String(active.id)
    const overId = String(over.id)
    const targetColumn = columns.find((c) => c.id === overId)

    if (targetColumn) {
      const task = tasks.find((t) => t.id === taskId)
      if (task && task.status !== targetColumn.id) {
        try {
          await updateTask(projectId, taskId, { status: targetColumn.id })
          toast.success(`Task moved to ${targetColumn.label}`)
          onRefresh()
        } catch {
          toast.error("Failed to move task")
        }
      }
    } else {
      const targetTask = tasks.find((t) => t.id === overId)
      if (targetTask && targetTask.id !== taskId) {
        const task = tasks.find((t) => t.id === taskId)
        if (task && task.status !== targetTask.status) {
          try {
            await updateTask(projectId, taskId, { status: targetTask.status })
            toast.success("Task moved")
            onRefresh()
          } catch {
            toast.error("Failed to move task")
          }
        }
      }
    }
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-3 overflow-x-auto pb-2">
        {columns.map((col) => {
          const colTasks = tasksByStatus(col.id)
          return (
            <div key={col.id} className="shrink-0 w-64">
              {/* Column header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={`size-2 rounded-full ${col.color}`} />
                <span className="text-xs font-semibold text-muted-foreground">{col.label}</span>
                <span className="text-xs text-muted-foreground ml-auto">{colTasks.length}</span>
              </div>

              {/* Drop zone */}
              <SortableContext
                id={col.id}
                items={colTasks.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className="min-h-50 rounded-lg bg-muted/30 p-2 space-y-2"
                  data-column={col.id}
                >
                  {colTasks.length === 0 && !activeId && (
                    <div className="py-8 text-center text-xs text-muted-foreground">No tasks</div>
                  )}
                  {colTasks.map((t) => (
                    <SortableTaskCard
                      key={t.id}
                      task={t}
                      disabled={!canEdit}
                      onClick={() => onTaskClick(t)}
                    />
                  ))}
                </div>
              </SortableContext>
            </div>
          )
        })}
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeTask ? (
          <div className="bg-card border border-border rounded-md p-3 shadow-lg max-w-60">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1 rounded">
                {typeLabel[activeTask.type] || "T"}
              </span>
              <span className="text-xs font-medium truncate">{activeTask.title}</span>
            </div>
            {(activeTask.assignee_nickname || activeTask.assignee_name) && (
              <p className="text-[10px] text-muted-foreground">{activeTask.assignee_nickname || activeTask.assignee_name}</p>
            )}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  )
}

export { priorityDot, typeLabel }
