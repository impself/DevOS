import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import * as authApi from "@/api/auth"

// User profile shape stored in context and localStorage
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

// AuthProvider — wraps the app, loads session from localStorage on mount
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  // Restore session from localStorage on mount
  useEffect(() => {
    const savedToken = localStorage.getItem("access_token")
    const savedUser = localStorage.getItem("user")
    if (savedToken && savedUser) {
      try {
        setToken(savedToken)
        setUser(JSON.parse(savedUser))
      } catch {
        localStorage.removeItem("access_token")
        localStorage.removeItem("user")
      }
    }
    setLoading(false)
  }, [])

  // Login — call API, persist token + user, navigate to dashboard
  const handleLogin = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password)
    if (res.code === 0 && res.data) {
      localStorage.setItem("access_token", res.data.access_token)
      localStorage.setItem("user", JSON.stringify(res.data.user))
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
      localStorage.setItem("access_token", res.data.access_token)
      localStorage.setItem("user", JSON.stringify(res.data.user))
      setToken(res.data.access_token)
      setUser(res.data.user)
      navigate("/dashboard")
    }
  }, [navigate])

  // Logout — clear state and localStorage, redirect to login
  const handleLogout = useCallback(() => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("user")
    localStorage.removeItem("devos_remember_email")
    setToken(null)
    setUser(null)
    navigate("/login")
  }, [navigate])

  // Update user in context and localStorage
  const updateUser = useCallback((updated: User) => {
    setUser(updated)
    localStorage.setItem("user", JSON.stringify(updated))
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
