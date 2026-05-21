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
              <Route path="/projects/:id" element={<ProjectDetailPage />} />
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
