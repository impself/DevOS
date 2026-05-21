import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import type { Task } from "@/api/task"

const priorityDot: Record<string, string> = {
  high: "bg-red-500",
  medium: "bg-yellow-500",
  low: "bg-blue-500",
}

const typeLabel: Record<string, string> = {
  task: "T", bug: "B", feature: "F", improvement: "I",
}

interface SortableTaskCardProps {
  task: Task
  disabled: boolean
  onClick: () => void
}

export default function SortableTaskCard({ task, disabled, onClick }: SortableTaskCardProps) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: task.id, disabled })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className="bg-card border border-border rounded-md p-3 cursor-pointer hover:border-primary/30 transition-colors"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[10px] font-bold text-muted-foreground bg-muted px-1 rounded">
          {typeLabel[task.type] || "T"}
        </span>
        <span className="text-xs font-medium truncate flex-1">{task.title}</span>
      </div>
      {/* Tags row */}
      {task.tags && task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {task.tags.map((t) => (
            <span
              key={t.id}
              className="text-[10px] px-1.5 py-px rounded-full font-medium"
              style={{ backgroundColor: t.color + "20", color: t.color }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}
      <div className="flex items-center gap-2">
        {task.priority && priorityDot[task.priority] && (
          <div className={`size-1.5 rounded-full ${priorityDot[task.priority]}`} title={task.priority} />
        )}
        {(task.assignee_nickname || task.assignee_name) && (
          <span className="text-[10px] text-muted-foreground truncate">{task.assignee_nickname || task.assignee_name}</span>
        )}
        {task.due_date && (
          <span className="text-[10px] text-muted-foreground ml-auto">
            {new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </span>
        )}
      </div>
    </div>
  )
}
