import type { LucideIcon } from "lucide-react"

// PlaceholderPage — 模块开发中的占位页面
interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  description: string
}

export default function PlaceholderPage({ icon: Icon, title, description }: PlaceholderPageProps) {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
      <div className="text-center max-w-md">
        <div className="mx-auto mb-6 size-16 rounded-2xl bg-primary/8 flex items-center justify-center">
          <Icon className="size-8 text-primary/50" />
        </div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        <div className="mt-6 inline-flex items-center gap-2 text-xs text-muted-foreground/60 bg-muted/50 px-3 py-1.5 rounded-full">
          <span className="size-1.5 rounded-full bg-amber-500/60 animate-pulse" />
          Coming Soon
        </div>
      </div>
    </div>
  )
}
