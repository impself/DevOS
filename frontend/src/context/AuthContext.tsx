import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import * as authApi from "@/api/auth"

// User profile shape stored in context and sessionStorage
export interface User {
  id: string
  email: string
  username: string
  nickname?: string
  avatar?: string
  role: string
}

// Auth context value — exposes user state and auth actions
interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  updateUser: (user: User) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

// AuthProvider — wraps the app, loads session on mount.
// access_token → sessionStorage (tab-isolated for multi-account support).
// refresh_token → localStorage (persists across tabs/closes, enables session restore).
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Restore session on mount: try access_token first, then refresh_token
  useEffect(() => {
    const init = async () => {
      const savedToken = sessionStorage.getItem("access_token")
      const savedUser = sessionStorage.getItem("user")

      // Path A: access_token exists in sessionStorage — verify and refresh user data
      if (savedToken && savedUser) {
        try {
          setToken(savedToken)
          setUser(JSON.parse(savedUser))
          const meRes = await authApi.getMe()
          if (meRes.code === 0 && meRes.data) {
            const refreshed = { ...JSON.parse(savedUser), ...meRes.data }
            setUser(refreshed)
            sessionStorage.setItem("user", JSON.stringify(refreshed))
          }
        } catch {
          // getMe failed, 401 interceptor will try refresh or redirect
          sessionStorage.removeItem("access_token")
          sessionStorage.removeItem("user")
        }
        setLoading(false)
        return
      }

      // Path B: no access_token, try to restore from refresh_token in localStorage
      const savedRefreshToken = localStorage.getItem("refresh_token")
      if (savedRefreshToken) {
        try {
          const res = await authApi.refreshToken(savedRefreshToken)
          if (res.code === 0 && res.data) {
            sessionStorage.setItem("access_token", res.data.access_token)
            sessionStorage.setItem("user", JSON.stringify(res.data.user))
            localStorage.setItem("refresh_token", res.data.refresh_token)
            setToken(res.data.access_token)
            setUser(res.data.user)
          }
        } catch {
          localStorage.removeItem("refresh_token")
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  // Login — call API, persist tokens, navigate to dashboard
  const handleLogin = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    if (res.code === 0 && res.data) {
      sessionStorage.setItem("access_token", res.data.access_token)
      localStorage.setItem("refresh_token", res.data.refresh_token)
      sessionStorage.setItem("user", JSON.stringify(res.data.user))
      setToken(res.data.access_token)
      setUser(res.data.user)
      navigate("/dashboard")
    } else {
      throw new Error(res.message || "Login failed")
    }
  }, [navigate])

  // Register — call API, then auto-login
  const handleRegister = useCallback(async (email: string, username: string, password: string) => {
    await authApi.register(email, username, password)
    const res = await authApi.login(email, password)
    if (res.code === 0 && res.data) {
      sessionStorage.setItem("access_token", res.data.access_token)
      localStorage.setItem("refresh_token", res.data.refresh_token)
      sessionStorage.setItem("user", JSON.stringify(res.data.user))
      setToken(res.data.access_token)
      setUser(res.data.user)
      navigate("/dashboard")
    }
  }, [navigate])

  // Logout — clear all state and storage, redirect to login
  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("access_token")
    sessionStorage.removeItem("user")
    localStorage.removeItem("refresh_token")
    setToken(null)
    setUser(null)
    navigate("/login")
  }, [navigate])

  // Update user in context and sessionStorage
  const updateUser = useCallback((updated: User) => {
    setUser(updated)
    sessionStorage.setItem("user", JSON.stringify(updated))
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        loading,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// useAuth — hook for components to access auth state and actions
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
