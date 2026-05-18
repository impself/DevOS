import { Navigate, useLocation } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"

// ProtectedRoute — wraps routes that require authentication
// Redirects unauthenticated users to /login with return URL preserved
export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}
