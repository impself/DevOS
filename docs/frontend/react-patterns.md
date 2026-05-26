# React Patterns Used in DevOS

DevOS 前端采用 React 19 + TypeScript + Vite，使用了多种 React 模式和最佳实践。

---

## 1. 路由与代码分割

### 懒加载路由

```tsx
// App.tsx
import { lazy, Suspense } from "react"

const LoginPage = lazy(() =>
  import("@/components/ui/animated-characters-login-page")
    .then((m) => ({ default: m.Component }))
)
const DashboardPage = lazy(() => import("@/pages/DashboardPage"))
const ProjectDetailPage = lazy(() => import("@/pages/ProjectDetailPage"))
```

**为什么用 lazy + Suspense？**
- 首屏只加载 Login/Register 代码，Dashboard 等页面按需加载
- 减少初始 bundle 大小，加快首屏渲染
- `Suspense` 提供统一的加载 fallback

### 路由守卫

```tsx
// 公开路由 — 已登录用户不能访问（Login/Register）
<Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />

// 受保护路由 — 未登录用户跳转到 /login
<Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/projects/:id" element={<ProjectDetailPage />} />
</Route>
```

```tsx
// ProtectedRoute.tsx
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div>Loading...</div>
  if (!user) return <Navigate to="/login" />
  return children
}
```

---

## 2. Context 状态管理

### AuthContext — 全局认证状态

```tsx
// context/AuthContext.tsx
const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // 应用启动时检查 token 有效性
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (token) {
      api.get("/auth/me").then(res => setUser(res.data.data))
        .catch(() => localStorage.removeItem("token"))
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const res = await api.post("/auth/login", { email, password })
    localStorage.setItem("token", res.data.access_token)
    setUser(res.data.user)
  }

  const logout = () => {
    localStorage.removeItem("token")
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
```

### ToastContext — 全局通知

```tsx
// context/ToastContext.tsx
const ToastContext = createContext<ToastContextType | null>(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (message: string, type: "success" | "error") => {
    const id = Date.now().toString()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }

  return (
    <ToastContext.Provider value={{ toast: { success: (m) => addToast(m, "success"), error: (m) => addToast(m, "error") } }}>
      {children}
      {/* 渲染 toast 列表 */}
    </ToastContext.Provider>
  )
}
```

**为什么用 Context 而不是 Redux？**
- 全局状态只有 `user` 和 `toasts`，非常简单
- Context 足以处理低频更新的状态
- Redux 适合复杂状态机（如表单状态、分页状态等）

---

## 3. API 层设计

### Axios Client 封装

```tsx
// api/client.ts
import axios from "axios"

const api = axios.create({
  baseURL: "/api/v1",
})

// 请求拦截器 — 自动附加 token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// 响应拦截器 — 401 自动跳转登录
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token")
      window.location.href = "/login"
    }
    return Promise.reject(err)
  }
)

export default api
```

### API 函数模式

```tsx
// api/task.ts
export interface Task {
  id: string
  title: string
  status: string
  // ...
}

export async function listTasks(projectId: string, filters?: TaskFilters) {
  const { data } = await api.get<TaskListResponse>(`/projects/${projectId}/tasks`, {
    params: filters,
  })
  return data
}

export async function createTask(projectId: string, req: CreateTaskReq) {
  const { data } = await api.post(`/projects/${projectId}/tasks`, req)
  return data
}
```

**设计原则：**
- 每个 API 文件对应一个后端模块（task.ts → task 模块）
- 用 TypeScript interface 定义请求和响应类型
- 函数签名清晰：`(资源ID, 请求体) => 响应`

---

## 4. 组件设计模式

### Modal 模式

```tsx
// 通用 Modal 结构
function CreateTaskModal({ onClose, onCreated }: Props) {
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await createTask(projectId, formData)
      if (res.code === 0) {
        toast.success("Created")
        onCreated()    // 通知父组件刷新数据
        onClose()      // 关闭弹窗
      }
    } catch {
      toast.error("Failed")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    // 遮罩层点击关闭
    <div className="fixed inset-0 z-50 bg-black/50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {/* 内容 */}
      </div>
    </div>
  )
}
```

### Drawer 模式

```tsx
// TaskDetailDrawer — 侧边抽屉
function TaskDetailDrawer({ task, onClose }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="w-full max-w-lg bg-background border-l">
        {/* 内容 */}
      </div>
    </div>
  )
}
```

### 列表 + 详情模式

```tsx
// ProjectDetailPage.tsx
const [tasks, setTasks] = useState<Task[]>([])
const [selectedTask, setSelectedTask] = useState<Task | null>(null)

// 列表页点击 → 打开详情
{tasks.map(t => (
  <div key={t.id} onClick={() => setSelectedTask(t)}>
    {t.title}
  </div>
))}

// 详情抽屉
{selectedTask && (
  <TaskDetailDrawer
    task={selectedTask}
    onClose={() => setSelectedTask(null)}
    onUpdated={fetchTasks}
  />
)}
```

---

## 5. useCallback 优化数据获取

```tsx
// ProjectDetailPage.tsx

const fetchTasks = useCallback(async () => {
  if (!id) return
  try {
    const res = await listTasks(id, {
      ...taskFilter,
      search: taskSearch || undefined,
      page: taskPage,
    })
    if (res.code === 0) {
      setTasks(res.data || [])
      setTaskTotal(res.pagination?.total || 0)
    }
  } catch {
    toast.error("Failed to load tasks")
  }
}, [id, taskFilter, taskSearch, taskPage, toast])

// 依赖变化时自动重新获取
useEffect(() => { fetchTasks() }, [fetchTasks])
```

**为什么用 `useCallback`？**
- `fetchTasks` 作为依赖传入 `useEffect`
- 不用 `useCallback` 每次渲染都会创建新函数 → `useEffect` 无限触发
- `useCallback` + `useEffect` 是 React 数据获取的经典模式

---

## 6. 条件渲染与状态机

```tsx
// 三种状态：加载中、空、有数据
{loading ? (
  <SkeletonProjectDetail />
) : tasks.length === 0 ? (
  <div className="flex flex-col items-center py-12">
    <CircleDot className="size-8 opacity-40" />
    <p>No tasks yet</p>
  </div>
) : viewMode === "kanban" ? (
  <TaskKanban tasks={tasks} ... />
) : (
  <div className="divide-y">
    {tasks.map(t => <TaskRow key={t.id} task={t} />)}
  </div>
)}
```

---

## 7. 面试常见问题

### Q: React.lazy 和 dynamic import 的原理？

**A:**
- `React.lazy(() => import('./Module'))` 返回一个 Lazy 组件
- 首次渲染时触发 import，Vite/Webpack 会把这个模块打包成独立 chunk
- `<Suspense fallback={...}>` 在 chunk 加载期间显示 fallback
- 本质是代码分割（Code Splitting），按路由拆分 bundle

### Q: Context 和 Redux 的适用场景？

**A:**
- **Context** — 全局低频状态（用户信息、主题、语言），更新不频繁
- **Redux / Zustand** — 复杂状态逻辑、高频更新、需要中间件、状态可回溯
- DevOS 只用 Context 因为全局状态简单（user + toasts）

### Q: 为什么列表用 key？index 作为 key 有什么问题？

**A:**
- key 帮助 React 识别哪些元素变化了，最小化 DOM 操作
- index 作 key 的问题：列表重排时，React 认为 key=0 的元素还在，只是内容变了，导致不必要的更新和 bug（如表单输入错位）
- **始终用唯一 ID 作为 key**

### Q: useCallback 和 useMemo 的区别？

**A:**
- `useCallback(fn, deps)` — 缓存函数引用，`fn` 不变则返回相同引用
- `useMemo(() => value, deps)` — 缓存计算结果，`deps` 不变则返回相同值
- 用 `useCallback` 的场景：函数作为 `useEffect` 依赖或传给子组件
- 用 `useMemo` 的场景：昂贵计算或需要保持引用稳定的对象

### Q: React 19 有什么新特性？

**A:**
- **Actions** — 异步状态管理简化（pending 状态、错误处理、乐观更新）
- **use() Hook** — 在渲染中读取 Promise 和 Context
- **Server Components** — 服务端渲染组件
- **Document Metadata** — `<title>`, `<meta>` 自动提升到 `<head>`
- DevOS 目前用的是 React 19 的基础功能，还没有用 Actions 等新特性
