import { lazy, Suspense } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/context/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import GuestRoute from "@/components/GuestRoute"
import DashboardLayout from "@/layouts/DashboardLayout"

// Lazy load page components for code splitting
const LoginPage = lazy(() =>
  import("@/components/ui/animated-characters-login-page").then((m) => ({ default: m.Component }))
)
const RegisterPage = lazy(() =>
  import("@/components/ui/animated-characters-register-page").then((m) => ({ default: m.Component }))
)
const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetailPage"))
const AccountSettingsPage = lazy(() => import("@/pages/AccountSettingsPage"))
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"))
const DocumentsPage = lazy(() => import("@/pages/DocumentsPage"))
const AgentPage = lazy(() => import("@/pages/AgentPage"))
const CodePage = lazy(() => import("@/pages/CodePage"))
const AuditPage = lazy(() => import("@/pages/AuditPage"))
const NotificationsPage = lazy(() => import("@/pages/NotificationsPage"))
const KnowledgePage = lazy(() => import("@/pages/KnowledgePage"))
const TeamPage = lazy(() => import("@/pages/TeamPage"))
const SearchPage = lazy(() => import("@/pages/SearchPage"))

// Minimal loading fallback for route transitions
function PageLoader() {
  return <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">Loading...</div>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/projects" element={<ProjectsPage />} />
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
              <Route path="/documents" element={<DocumentsPage />} />
              <Route path="/agent" element={<AgentPage />} />
              <Route path="/code" element={<CodePage />} />
              <Route path="/knowledge" element={<KnowledgePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/team" element={<TeamPage />} />
              <Route path="/audit" element={<AuditPage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<AccountSettingsPage />} />
            </Route>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  )
}
