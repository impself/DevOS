import { cn } from "@/lib/utils"
import { forwardRef, type HTMLAttributes } from "react"

const Skeleton = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("skeleton-shimmer rounded-md", className)}
      {...props}
    />
  ),
)
Skeleton.displayName = "Skeleton"
export { Skeleton }

/** Matches the project card grid in DashboardPage */
export function SkeletonCard() {
  return (
    <div className="border border-border rounded-lg p-5 space-y-3">
      <Skeleton className="h-4 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-1/3 mt-2" />
    </div>
  )
}

/** Matches the project info + task section in ProjectDetailPage */
export function SkeletonProjectDetail() {
  return (
    <div className="space-y-6 max-w-5xl mx-auto p-6 lg:p-8">
      {/* Back button skeleton */}
      <Skeleton className="h-4 w-28" />
      {/* Project info card */}
      <div className="border border-border rounded-lg p-6 space-y-3">
        <Skeleton className="h-6 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/4 mt-2" />
      </div>
      {/* Task section card */}
      <div className="border border-border rounded-lg p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Skeleton className="h-5 w-20 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
