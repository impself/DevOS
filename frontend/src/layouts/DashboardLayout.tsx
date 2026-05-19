import { Link, Outlet } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { LogOut, FolderKanban, Settings, Sparkles } from "lucide-react"

// DashboardLayout — sidebar + top bar shell for all authenticated pages
export default function DashboardLayout() {
  const { user, logout } = useAuth()

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
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium bg-accent text-accent-foreground"
          >
            <FolderKanban className="size-4" />
            Projects
          </Link>
          <span
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-muted-foreground/50"
            title="Coming soon"
          >
            <Settings className="size-4" />
            Settings
          </span>
        </nav>

        {/* User section at bottom */}
        <div className="border-t border-border p-3">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="size-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
              {user?.username?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium truncate">{user?.username || "User"}</p>
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
        {/* Top bar for mobile — shows brand + logout */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <span className="font-semibold text-sm">DevOS</span>
          </div>
          <button type="button" onClick={logout} className="text-muted-foreground hover:text-foreground cursor-pointer">
            <LogOut className="size-4" />
          </button>
        </header>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
