import api from "./client"

// Login API response shape from backend
export interface LoginResponse {
  code: number
  message: string
  data: {
    access_token: string
    refresh_token: string
    expires_in: number
    user: {
      id: string
      email: string
      username: string
      nickname: string
      avatar: string
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

// POST /auth/login — authenticate with email + password, returns JWT token pair
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

// POST /auth/refresh — exchange refresh token for new access+refresh token pair
export async function refreshToken(refreshToken: string): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>("/auth/refresh", {
    refresh_token: refreshToken,
  }, { _retry: true } as never)
  return data
}

// GET /auth/me — fetch current authenticated user profile
export async function getMe() {
  const { data } = await api.get("/auth/me")
  return data
}

// PUT /auth/profile — update nickname and avatar
export async function updateProfile(nickname: string, avatar: string) {
  const { data } = await api.put("/auth/profile", { nickname, avatar })
  return data
}

// POST /auth/avatar — upload avatar image file
export async function uploadAvatar(file: File) {
  const formData = new FormData()
  formData.append("avatar", file)
  const { data } = await api.post("/auth/avatar", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  })
  return data
}
