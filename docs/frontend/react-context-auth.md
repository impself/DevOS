# React Context 与认证状态管理

## 基础概念

React Context 提供跨组件树传递数据的能力，避免 props 层层传递（prop drilling）。适用于全局状态如认证信息、主题、语言等。

### 为什么用 Context 而不是 Zustand/Redux

- DevOS 是小型项目，认证状态简单（user + token + isAuthenticated）
- Context + useState 足够，不需要额外依赖
- 如果后续状态变复杂，可以迁移到 Zustand（AGENTS.md 预留了技术选项）

## 核心用法

### AuthContext 实现模式

```typescript
// context/AuthContext.tsx
const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // 启动时从 localStorage 恢复会话
  useEffect(() => {
    const saved = localStorage.getItem("access_token")
    if (saved) { setToken(saved); setUser(/* ... */) }
  }, [])

  return (
    <AuthContext.Provider value={{ user, token, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
```

### 路由守卫模式

```typescript
// ProtectedRoute — 包裹需要认证的路由
function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" state={{ from: location }} replace />
  return <>{children}</>
}
```

## 核心思想 / 设计原理

1. **Provider 在最外层**：`<AuthProvider>` 包裹整个 `<Routes>`，确保所有页面都能访问认证状态
2. **懒恢复**：启动时从 localStorage 读 token，避免每次刷新都调 API
3. **单一职责**：Context 只管认证状态，不混入其他业务逻辑
4. **自定义 Hook 封装**：`useAuth()` 隐藏 Context 细节，组件只需调用

## 常见面试题

**Q1: Context 和 Redux 的区别？**
A: Context 是 React 内置的状态传递机制，适合低频更新的全局状态。Redux 是独立的状态管理库，适合高频更新、需要中间件、需要时间旅行的场景。

**Q2: 为什么 useAuth 里要 throw Error？**
A: 防止在 Provider 外部使用 hook 导致 undefined 错误。这是"依赖注入"模式的标准做法。

**Q3: token 存 localStorage 还是 sessionStorage？**
A: localStorage 持久化（关闭浏览器不丢失），适合"记住我"。sessionStorage 会话级（关闭标签页丢失），适合高安全要求场景。DevOS 用 localStorage + "记住我"选项。
