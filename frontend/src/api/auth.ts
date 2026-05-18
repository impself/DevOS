import api from "./client"

// Login API response shape from backend
export interface LoginResponse {
  code: number
  message: string
  data: {
    access_token: string
    user: {
      id: string
      email: string
      username: string
      role: string
    }
  }
}

// Register API response shape from backend
export interface RegisterResponse {
  code: number
  message: string
  data: {
    id: string
    email: string
    username: string
  }
}

// POST /auth/login — authenticate with email + password, returns JWT token
export async function login(email: string, password: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/login", { email, password })
  return data
}

// POST /auth/register — create a new user account
export async function register(
  email: string,
  username: string,
  password: string
): Promise<RegisterResponse> {
  const { data } = await api.post<RegisterResponse>("/auth/register", {
    email,
    username,
    password,
  })
  return data
}

// GET /auth/me — fetch current authenticated user profile
export async function getMe() {
  const { data } = await api.get("/auth/me")
  return data
}
