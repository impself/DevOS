import { useState } from "react"
import { Link, Outlet, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import {
  LogOut,
  LayoutDashboard,
  FolderKanban,
  FileText,
  Bot,
  GitBranch,
  BookOpen,
  Search,
  ShieldCheck,
  Bell,
  Users,
  Settings,
  Sparkles,
  Menu,
  Moon,
  Sun,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react"

// Sidebar section header — uppercase, muted, small; hidden when collapsed
function SectionHeader({ label, collapsed }: { label: string; collapsed?: boolean }) {
  if (collapsed) return <div className="pt-4" />
  return (
    <div className="px-4 pt-5 pb-2">
      <span className="text-[11px] font-semibold tracking-widest text-muted-foreground/60 uppercase">
        {label}
      </span>
    </div>
  )
}

// Sidebar nav link with active state indicator
function NavLink({
  to,
  icon: Icon,
  label,
  badge,
  active,
  onClick,
  collapsed,
}: {
  to: string
  icon: React.ElementType
  label: string
  badge?: number
  active: boolean
  onClick?: () => void
  collapsed?: boolean
}) {
  if (collapsed) {
    return (
      <Link
        to={to}
        onClick={onClick}
        title={label}
        className={`
          group relative flex items-center justify-center py-2 mx-2 rounded-lg
          transition-all duration-150 cursor-pointer
          ${
            active
              ? "bg-primary/8 text-foreground shadow-sm"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }
        `}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 rounded-r-full bg-primary" />
        )}
        <Icon className={`size-4.5 ${active ? "text-primary" : ""}`} />
      </Link>
    )
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`
        group relative flex items-center gap-3 px-3 py-2 mx-2 rounded-lg text-sm font-medium
        transition-all duration-150 cursor-pointer
        ${
          active
            ? "bg-primary/8 text-foreground shadow-sm"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }
      `}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 rounded-r-full bg-primary" />
      )}
      <Icon className={`size-4.5 ${active ? "text-primary" : ""}`} />
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="min-w-4.5 h-4.5 flex items-center justify-center rounded-full bg-destructive/10 text-destructive text-[10px] font-bold px-1">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </Link>
  )
}

// DashboardLayout — sidebar + top bar shell for all authenticated pages
export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const displayName = user?.nickname || user?.username || "User"
  const initial = displayName.charAt(0).toUpperCase()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false
    return localStorage.getItem("devos_sidebar_collapsed") === "true"
  })
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false
    return document.documentElement.classList.contains("dark")
  })

  const closeSidebar = () => setSidebarOpen(false)

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem("devos_sidebar_collapsed", String(next))
      return next
    })
  }

  const toggleTheme = () => {
    setDark((prev) => {
      const next = !prev
      document.documentElement.classList.toggle("dark", next)
      localStorage.setItem("devos_theme", next ? "dark" : "light")
      return next
    })
  }

  const isActive = (path: string) => {
    if (path === "/dashboard") return location.pathname === "/dashboard"
    return location.pathname.startsWith(path)
  }

  const renderNavContent = (onNavigate?: () => void) => (
    <>
      {/* Brand */}
      <div className="flex items-center gap-2.5 h-14 shrink-0" style={collapsed ? { padding: "0 0.625rem" } : { padding: "0 1.25rem" }}>
        <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="size-4 text-primary" />
        </div>
        {!collapsed && <span className="font-semibold text-sm tracking-tight">DevOS</span>}
      </div>

      {/* Navigation section */}
      <SectionHeader label="Navigation" collapsed={collapsed} />
      <div className="space-y-0.5">
        <NavLink
          to="/dashboard"
          icon={LayoutDashboard}
          label="Dashboard"
          active={isActive("/dashboard")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
        <NavLink
          to="/projects"
          icon={FolderKanban}
          label="Projects"
          active={isActive("/projects")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
        <NavLink
          to="/documents"
          icon={FileText}
          label="Documents"
          active={isActive("/documents")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
      </div>

      {/* Tools section */}
      <SectionHeader label="Tools" collapsed={collapsed} />
      <div className="space-y-0.5">
        <NavLink
          to="/agent"
          icon={Bot}
          label="AI Agent"
          active={isActive("/agent")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
        <NavLink
          to="/code"
          icon={GitBranch}
          label="Code"
          active={isActive("/code")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
        <NavLink
          to="/knowledge"
          icon={BookOpen}
          label="Knowledge Base"
          active={isActive("/knowledge")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
        <NavLink
          to="/search"
          icon={Search}
          label="Search"
          active={isActive("/search")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
      </div>

      {/* System section */}
      <SectionHeader label="System" collapsed={collapsed} />
      <div className="space-y-0.5">
        <NavLink
          to="/team"
          icon={Users}
          label="Team"
          active={isActive("/team")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
        <NavLink
          to="/notifications"
          icon={Bell}
          label="Notifications"
          active={isActive("/notifications")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
        <NavLink
          to="/audit"
          icon={ShieldCheck}
          label="Audit Log"
          active={isActive("/audit")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
      </div>

      {/* Account section */}
      <SectionHeader label="Account" collapsed={collapsed} />
      <div className="space-y-0.5">
        <NavLink
          to="/settings"
          icon={Settings}
          label="Settings"
          active={isActive("/settings")}
          onClick={onNavigate}
          collapsed={collapsed}
        />
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Theme toggle */}
      <div className="px-2 py-2">
        <button
          type="button"
          onClick={toggleTheme}
          title={collapsed ? (dark ? "Light Mode" : "Dark Mode") : undefined}
          className={`flex items-center gap-3 py-2 w-full rounded-lg text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer ${
            collapsed ? "justify-center px-0" : "px-3"
          }`}
        >
          {dark ? <Sun className="size-4.5 shrink-0" /> : <Moon className="size-4.5 shrink-0" />}
          {!collapsed && <span>{dark ? "Light Mode" : "Dark Mode"}</span>}
        </button>
      </div>

      {/* User profile */}
      <div className="border-t border-border p-3">
        <div className={`flex items-center gap-3 py-1.5 ${collapsed ? "justify-center px-0" : "px-2"}`}>
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={displayName}
              className="size-9 rounded-full object-cover ring-2 ring-border shrink-0"
            />
          ) : (
            <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary ring-2 ring-border shrink-0">
              {initial}
            </div>
          )}
          {!collapsed && (
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
          )}
          {!collapsed && (
            <button
              type="button"
              onClick={logout}
              className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer rounded-md hover:bg-accent p-1 shrink-0"
              title="Logout"
            >
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <div className="min-h-screen flex bg-background">
      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex relative flex-col bg-card/50 backdrop-blur-xl border-r border-border shadow-sm transition-all duration-200 ${
          collapsed ? "w-16" : "w-60"
        }`}
      >
        {renderNavContent()}

        {/* Collapse toggle — absolutely positioned at brand row end */}
        <button
          type="button"
          onClick={toggleCollapse}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute top-4 right-0 translate-x-1/2 z-10 size-6 rounded-full border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer shadow-sm"
        >
          {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
        </button>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={closeSidebar} />
          <aside className="relative w-60 h-full bg-card border-r border-border flex flex-col animate-slide-in-left shadow-xl">
            {renderNavContent(closeSidebar)}
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
