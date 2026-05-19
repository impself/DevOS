import { Navigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

// GuestRoute — wraps routes that should only be accessible to unauthenticated users
// Redirects authenticated users to /dashboard
// Shows spinner while auth state loads (prevents flash on refresh)
export default function GuestRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
