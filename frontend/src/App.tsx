import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { AuthProvider } from "@/context/AuthContext"
import ProtectedRoute from "@/components/ProtectedRoute"
import GuestRoute from "@/components/GuestRoute"
import { Component as LoginPage } from "@/components/ui/animated-characters-login-page"
import { Component as RegisterPage } from "@/components/ui/animated-characters-register-page"
import DashboardLayout from "@/layouts/DashboardLayout"
import DashboardPage from "@/pages/DashboardPage"
import ProjectDetailPage from "@/pages/ProjectDetailPage"
import AccountSettingsPage from "@/pages/AccountSettingsPage"

// App root — wraps entire app with AuthProvider and sets up client-side routing
export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes — only accessible when NOT authenticated */}
          <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
          <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

          {/* Protected routes — require authentication, share dashboard layout */}
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

          {/* Default redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* 404 fallback */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
