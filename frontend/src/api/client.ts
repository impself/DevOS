import axios from "axios"

// Axios instance pre-configured with backend base URL and JSON content type
const api = axios.create({
  baseURL: "http://localhost:8080/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
})

// Request interceptor — attach JWT access token from sessionStorage
api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("access_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Token refresh queue — prevents concurrent refresh calls
let isRefreshing = false
let pendingQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

function processQueue(token: string | null) {
  pendingQueue.forEach((p) => {
    if (token) p.resolve(token)
    else p.reject(new Error("refresh failed"))
  })
  pendingQueue = []
}

function forceLogout() {
  sessionStorage.removeItem("access_token")
  sessionStorage.removeItem("user")
  localStorage.removeItem("refresh_token")
  window.location.href = "/login"
}

// Response interceptor — handle 401 with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // If the request was already a retry or is the refresh endpoint itself, skip
    if (originalRequest?._retry || originalRequest?.url === "/auth/refresh") {
      forceLogout()
      return Promise.reject(error)
    }

    if (error.response?.status !== 401) {
      return Promise.reject(error)
    }

    const savedRefreshToken = localStorage.getItem("refresh_token")
    if (!savedRefreshToken) {
      forceLogout()
      return Promise.reject(error)
    }

    // If already refreshing, queue this request
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({
          resolve: (token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            resolve(api(originalRequest))
          },
          reject,
        })
      })
    }

    isRefreshing = true

    try {
      // Use raw axios to avoid intercepting the refresh response
      const { data } = await axios.post("http://localhost:8080/api/v1/auth/refresh", {
        refresh_token: savedRefreshToken,
      })

      if (data.code === 0 && data.data) {
        const newAccessToken = data.data.access_token
        const newRefreshToken = data.data.refresh_token

        sessionStorage.setItem("access_token", newAccessToken)
        localStorage.setItem("refresh_token", newRefreshToken)

        processQueue(newAccessToken)

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      }

      // Refresh token invalid
      processQueue(null)
      forceLogout()
      return Promise.reject(error)
    } catch {
      processQueue(null)
      forceLogout()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)

export default api
