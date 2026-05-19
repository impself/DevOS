import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

// ProtectedRoute — wraps routes that require authentication
// While auth state is loading (page refresh), shows spinner instead of redirecting
// Redirects unauthenticated users to /login with return URL preserved once loading completes
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  // Still checking stored session — don't redirect yet, avoid flash redirect on refresh
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="size-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
