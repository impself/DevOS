import { useState, useEffect } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { LogOut, FolderKanban, Settings, Sparkles, Menu, Moon, Sun } from "lucide-react"

// DashboardLayout — sidebar + top bar shell for all authenticated pages
export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const displayName = user?.nickname || user?.username || "User"
  const initial = displayName.charAt(0).toUpperCase()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false
    return document.documentElement.classList.contains("dark")
  })

  // Close mobile sidebar on route change
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle("dark", next)
      localStorage.setItem("devos_theme", next ? "dark" : "light")
      return next
    })
  }

  const navLinks = (
    <>
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
    </>
  )

  const userSection = (
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
  )

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 flex-col border-r border-border bg-card">
        {/* Brand */}
        <div className="flex items-center gap-2 px-5 h-14 border-b border-border">
          <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center">
            <Sparkles className="size-3.5 text-primary" />
          </div>
          <span className="font-semibold text-sm">DevOS</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navLinks}
        </nav>

        {/* Theme toggle */}
        <div className="px-3 py-2 border-t border-border">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
          >
            {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
        </div>

        {/* User */}
        <div className="border-t border-border p-3">
          {userSection}
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <aside className="relative w-60 h-full bg-card border-r border-border flex flex-col animate-slide-in-left">
            <div className="flex items-center gap-2 px-5 h-14 border-b border-border">
              <div className="size-7 rounded-md bg-primary/10 flex items-center justify-center">
                <Sparkles className="size-3.5 text-primary" />
              </div>
              <span className="font-semibold text-sm">DevOS</span>
            </div>
            <nav className="flex-1 py-4 px-3 space-y-1">
              {navLinks}
            </nav>
            <div className="px-3 py-2 border-t border-border">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex items-center gap-3 px-3 py-2 w-full rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
              >
                {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {dark ? "Light Mode" : "Dark Mode"}
              </button>
            </div>
            <div className="border-t border-border p-3">
              {userSection}
            </div>
          </aside>
        </div>
      )}

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Top bar for mobile */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 border-b border-border">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="p-1 rounded-md hover:bg-muted text-muted-foreground cursor-pointer"
            >
              <Menu className="size-5" />
            </button>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <span className="font-semibold text-sm">DevOS</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground cursor-pointer"
              title="Toggle theme"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
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
