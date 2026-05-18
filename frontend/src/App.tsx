import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { Component as LoginPage } from "@/components/ui/animated-characters-login-page"
import { Component as RegisterPage } from "@/components/ui/animated-characters-register-page"

// App root — sets up client-side routing for the SPA
export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Login page with animated cartoon characters */}
        <Route path="/login" element={<LoginPage />} />

        {/* Register page — characters unlock as fields are filled */}
        <Route path="/register" element={<RegisterPage />} />

        {/* Default redirect — send all users to login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Dashboard placeholder — will be built in next phase */}
        <Route
          path="/dashboard"
          element={
            <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
              <div className="text-center">
                <h1 className="text-2xl font-bold">Dashboard</h1>
                <p className="text-muted-foreground mt-2">Coming soon...</p>
              </div>
            </div>
          }
        />

        {/* 404 fallback */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
