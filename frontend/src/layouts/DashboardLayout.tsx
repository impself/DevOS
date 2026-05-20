import { Link, Outlet } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { LogOut, FolderKanban, Settings, Sparkles } from "lucide-react"

// DashboardLayout — sidebar + top bar shell for all authenticated pages
export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const displayName = user?.nickname || user?.username || "User"
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card">
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 h-14 border-b border-border">
          <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm">DevOS</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          <Link
            to="/dashboard"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <FolderKanban className="size-4" />
            Projects
          </Link>
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Settings className="size-4" />
            Settings
          </Link>
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            {user?.avatar ? (
              <img src={user.avatar} alt={displayName} className="size-8 rounded-full object-cover" />
            ) : (
              <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                {initial}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{displayName}</p>
                {user?.role === "admin" && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-semibold">
                    ADMIN
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground truncate">{user?.email || ""}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              title="Logout"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar for mobile */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="font-semibold text-sm">DevOS</span>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/settings" className="text-muted-foreground hover:text-foreground cursor-pointer">
              <Settings className="size-4" />
            </Link>
            <button type="button" onClick={logout} className="text-muted-foreground hover:text-foreground cursor-pointer">
              <LogOut className="size-4" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
