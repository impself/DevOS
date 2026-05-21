---
name: devos-frontend
description: DevOS 项目前端编码规范 — 组件/样式/API/路由/状态管理/动画的全栈开发指导，确保项目代码风格统一、可维护、高质量
license: MIT
user-invocable: true
disable-model-invocation: false
---

# DevOS 前端开发规范

本 Skill 定义 DevOS 项目前端开发的所有编码规范和最佳实践。任何在此项目中编写前端代码的行为都必须遵循本规范。

---

## 1. 技术栈声明

| 类别 | 技术 | 用途 |
|------|------|------|
| 框架 | React 19.2+ | UI 框架 |
| 语言 | TypeScript 6.0+ (strict) | 类型安全 |
| 构建 | Vite 8.0+ | 开发 & 构建 |
| 样式 | Tailwind CSS 4.3+ | 主样式方案 |
| 样式补充 | styled-components 6.4+ | 复杂组件样式（showcase） |
| 组件库 | Radix UI | 无障碍基础组件 |
| 请求 | Axios 1.16+ | HTTP 客户端 |
| 数据层 | TanStack Query 5.100+ | 服务端状态管理 |
| 路由 | React Router DOM 7.15+ | 客户端路由 |
| 图标 | Lucide React 1.16+ | 图标集 |
| 工具 | clsx + tailwind-merge + cva | 类名合并 & 变体管理 |
| 拖拽 | dnd-kit | 拖拽排序 |

### 1.1 拒绝清单

**以下技术不允许出现在本项目代码中：**
- 其他 HTTP 库（如 `fetch` 原生封装、`ky`、`superagent`） — 统一用 Axios
- 其他状态管理库（如 Redux、Zustand、Jotai） — 用 Context + React Query
- 其他 CSS 框架（如 Ant Design、MUI、Chakra UI） — 用 Tailwind + Radix
- 非 `@/` 的路径别名 — 统一用 `@/`

---

## 2. 目录结构规范

```
frontend/src/
├── api/                  # API 层：每个模块一个文件
│   ├── client.ts         # Axios 实例 + 拦截器
│   ├── auth.ts           # 认证相关 API
│   ├── project.ts        # 项目 CRUD API
│   ├── task.ts           # 任务管理 API
│   └── comment.ts        # 评论 API
├── components/           # 组件
│   ├── ui/               # 基础 UI 组件（Button, Input, Label...）
│   ├── showcase/         # 展示型组件（玻璃拟态样式组件）
│   ├── ProtectedRoute.tsx
│   ├── GuestRoute.tsx
│   ├── CreateTaskModal.tsx
│   ├── TaskDetailDrawer.tsx
│   ├── TaskKanban.tsx
│   └── ...
├── context/              # React Context
│   ├── AuthContext.tsx
│   └── ToastContext.tsx
├── layouts/              # 布局组件
│   └── DashboardLayout.tsx
├── lib/                  # 工具函数
│   └── utils.ts          # cn() 类名合并
├── pages/                # 页面组件
│   ├── DashboardPage.tsx
│   ├── ProjectDetailPage.tsx
│   └── AccountSettingsPage.tsx
├── App.tsx               # 路由入口
├── main.tsx              # 应用入口
└── index.css             # 全局样式 + CSS 变量
```

### 2.1 文件放置规则

| 文件类型 | 放置位置 | 命名规则 |
|----------|----------|----------|
| API 函数 | `api/<模块名>.ts` | camelCase，按资源分文件 |
| 基础 UI 组件 | `components/ui/<name>.tsx` | kebab-case 文件，PascalCase 组件 |
| 展示组件 | `components/showcase/<Name>.tsx` | PascalCase 文件，PascalCase 组件 |
| 业务组件 | `components/<Name>.tsx` | PascalCase |
| Context | `context/<Name>Context.tsx` | PascalCase + Context 后缀 |
| 页面 | `pages/<PageName>Page.tsx` | PascalCase + Page 后缀 |
| 布局 | `layouts/<Name>Layout.tsx` | PascalCase + Layout 后缀 |
| 工具函数 | `lib/<name>.ts` | camelCase |

---

## 3. 组件开发规范

### 3.1 基础 UI 组件（ui/ 目录）

遵循 shadcn/ui 风格，使用以下模式：

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const componentVariants = cva(
  "base-classes-here",
  {
    variants: {
      variant: {
        default: "variant-classes",
        secondary: "variant-classes",
      },
      size: {
        default: "size-classes",
        sm: "size-classes",
        lg: "size-classes",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ComponentProps
  extends React.HTMLAttributes<HTMLElement>,
    VariantProps<typeof componentVariants> {
  // 自定义 props
}

const Component = React.forwardRef<HTMLElement, ComponentProps>(
  ({ className, variant, size, ...props }, ref) => (
    <div
      className={cn(componentVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
)
Component.displayName = "Component"

export { Component, componentVariants }
```

**规则：**
- 必须使用 `React.forwardRef` 传递 ref
- 必须设置 `displayName`
- 使用 `cva` 管理变体，导出 `variants` 对象供外部扩展
- 使用 `cn()` 合并类名，不允许拼接 className 字符串
- 文件使用 kebab-case 命名，组件使用 PascalCase 命名
- 统一使用**命名导出** `export { Component }`

### 3.2 业务组件

```tsx
import { useAuth } from "@/context/AuthContext"
import { useToast } from "@/context/ToastContext"
import { useQuery } from "@tanstack/react-query"

// Props 接口定义在组件文件内
interface TaskCardProps {
  taskId: string
  onUpdate?: (id: string) => void
}

export default function TaskCard({ taskId, onUpdate }: TaskCardProps) {
  // 组件逻辑...
}
```

**规则：**
- Props 接口定义在组件文件内，不需要导出（除非外部需要引用）
- 路径引用统一使用 `@/` 别名，禁止相对路径引用（`../../`）
- 业务组件可使用**默认导出** `export default`
- 组件无副作用时优先使用纯函数组件

### 3.3 页面组件

**规则：**
- 放在 `pages/` 目录下，命名 `XxxPage.tsx`
- 使用默认导出
- 页面组件负责组合布局和业务组件，不包含复杂业务逻辑
- 数据获取使用 React Query hooks

### 3.4 组件拆分粒度

- **展示组件 vs 容器组件**：展示组件只渲染 props，容器组件负责数据获取和逻辑
- 超过 200 行的组件必须考虑拆分
- 重复出现 3 次以上的 UI 片段必须抽取为独立组件

---

## 4. 样式规范

### 4.1 样式方案选择

| 场景 | 方案 | 理由 |
|------|------|------|
| 基础 UI 组件 | Tailwind + cva | 类型安全变体，易于复用 |
| 业务组件 | Tailwind + cn() | 快速开发，全局一致 |
| 复杂视觉组件 | styled-components | 多层效果、复杂动画、精细控制 |
| 全局样式 | CSS 变量 + index.css | 主题控制、DOM 无关 |

### 4.2 Tailwind 使用规范

```tsx
// ✅ 正确：使用 cn() 合并
<div className={cn("flex items-center gap-2", isActive && "text-primary")} />

// ❌ 错误：字符串拼接
<div className={`flex items-center gap-2 ${isActive ? "text-primary" : ""}`} />

// ✅ 正确：使用 CSS 变量 token
<div className="bg-background text-foreground border border-border" />

// ❌ 错误：硬编码颜色值
<div className="bg-white text-black" />
```

**规则：**
- 颜色必须用 CSS 变量 token（`bg-primary`、`text-muted-foreground` 等），不用硬编码值
- 优先 Tailwind 原子类，不写内联 `style={}`
- 复杂条件类名必须用 `cn()` 或 `cva`
- 禁止使用 `!important` 覆盖样式 — 应调整 CSS 变量或组件变体

### 4.3 styled-components 使用规范

```tsx
// ✅ 正确：整个组件包裹在一个 StyledWrapper 内
const StyledWrapper = styled.div`
  .container {
    /* 写在这个命名空间下 */
  }
`

function MyComponent() {
  return <StyledWrapper>...</StyledWrapper>
}

// ❌ 错误：每个元素都创建一个 styled 组件
const Container = styled.div``
const Header = styled.h2``
const Body = styled.p``
```

**规则：**
- 只在 `components/showcase/` 或明确需要玻璃拟态效果的组件中使用
- 整个组件用一个 `StyledWrapper` 包裹，通过 CSS 选择器写内部样式
- 不使用 ThemeProvider，直接写 CSS 值
- 过渡动画写 `transition: all 0.2s ease-in-out` 保持一致

### 4.4 CSS 变量体系

```css
/* 所有颜色使用 OKLCH 色彩空间 */
:root {
  --background: oklch(1 0 0);        /* 页面背景 */
  --foreground: oklch(0.145 0 0);    /* 文字颜色 */
  --card: oklch(1 0 0);              /* 卡片背景 */
  --primary: oklch(0.205 0 0);       /* 主色 */
  --secondary: oklch(0.97 0 0);      /* 次色 */
  --muted: oklch(0.97 0 0);          /* 弱化背景 */
  --muted-foreground: oklch(0.556 0 0); /* 弱化文字 */
  --destructive: oklch(0.577 0.245 27.325); /* 危险色 */
  --border: oklch(0.922 0 0);        /* 边框色 */
  --input: oklch(0.922 0 0);         /* 输入框边框 */
  --ring: oklch(0.708 0 0);          /* 焦点环 */
  --radius: 0.625rem;                /* 基础圆角 */
}

.dark {
  --background: oklch(0.145 0 0);
  /* ... */
  --bg-gradient: linear-gradient(135deg, #0f0c29 0%, #15122a 40%, #1a1535 70%, #12101e 100%);
}
```

### 4.5 暗色模式

```tsx
// 暗色模式通过 Tailwind dark: 前缀
<div className="bg-background dark:bg-background text-foreground dark:text-foreground" />

// 暗色背景下的玻璃拟态效果
<div className="backdrop-blur-md bg-card/60 dark:bg-card/30 border border-border/50" />
```

**规则：**
- 每写一个浅色样式，必须确认暗色模式下的表现
- 暗色模式使用 `bg-card/透明度` 实现半透明效果
- 玻璃拟态组件在暗色模式下降低透明度（`/60` → `/30`）

---

## 5. TypeScript 规范

### 5.1 配置文件要点

```json
{
  "compilerOptions": {
    "target": "es2023",
    "module": "esnext",
    "moduleResolution": "bundler",
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "paths": { "@/*": ["./src/*"] }
  }
}
```

### 5.2 类型导入

```tsx
// ✅ 正确：类型导入必须用 import type
import type { ReactNode } from "react"
import type { Task, CreateTaskReq } from "@/api/task"
import { useAuth } from "@/context/AuthContext"

// ❌ 错误：类型和值混在一起导入（verbatimModuleSyntax 不允许）
import { ReactNode, useState } from "react"
```

**规则：**
- TypeScript 类型导入必须使用 `import type { ... }` 语法
- `verbatimModuleSyntax: true` 要求显式区分类型和值的导入
- 接口名不加 `I` 前缀（如 `Task`，不写 `ITask`）

### 5.3 接口定义

```tsx
// API 响应类型 — 定义在 api/ 文件中
export interface TaskListResponse {
  code: number
  message: string
  data: Task[]
  pagination: { page: number; page_size: number; total: number }
}

// 组件 Props — 定义在组件文件内
interface TaskCardProps {
  task: Task
  onDelete?: (id: string) => void
}

// Hook 返回值 — 定义在 hook 文件内
interface UseTasksReturn {
  tasks: Task[]
  isLoading: boolean
  error: Error | null
}
```

### 5.4 泛型使用

```tsx
// React Query 常用泛型
const { data } = useQuery<TaskListResponse>({
  queryKey: ["tasks", projectId],
  queryFn: () => listTasks(projectId),
})

// Axios 响应泛型
const { data } = await api.get<TaskListResponse>(`/projects/${id}/tasks`)
```

---

## 6. API 调用规范

### 6.1 Axios 客户端

```ts
// api/client.ts — 项目唯一的 HTTP 客户端
const api = axios.create({
  baseURL: "http://localhost:8080/api/v1",
  headers: { "Content-Type": "application/json" },
})

// 自动注入 JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token")
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// 全局 401 拦截 — 清除认证并跳转登录
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token")
      localStorage.removeItem("user")
      window.location.href = "/login"
    }
    return Promise.reject(error)
  }
)
```

### 6.2 API 模块组织

```ts
// ✅ 每个资源模块一个文件
// api/task.ts — 任务相关所有 API

import api from "./client"
import type { Tag } from "./tag"

// 1. 先定义数据类型
export interface Task { /* ... */ }
export interface CreateTaskReq { /* ... */ }

// 2. 每个 API 函数带路径注释
// POST /projects/:id/tasks — 创建任务
export async function createTask(projectId: string, req: CreateTaskReq) {
  const { data } = await api.post(`/projects/${projectId}/tasks`, req)
  return data
}

// 3. 统一解构 { data } 返回
```

**规则：**
- 所有 API 函数使用 `export async function`（不用箭头函数）
- 每个函数上行必须有注释说明 HTTP 方法和路径
- 统一用 `const { data } = await api.xxx()` 解构
- 请求参数类型单独定义 interface
- 禁止在组件中直接调用 `api.xxx()` — 必须通过 api/ 模块的函数

### 6.3 React Query 使用

```tsx
// ✅ 查询 — useQuery
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { listTasks, createTask, deleteTask } from "@/api/task"

function useTasks(projectId: string) {
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: () => listTasks(projectId),
    enabled: !!projectId,
  })
}

// ✅ 变更 — useMutation + 乐观更新
function useCreateTask(projectId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (req: CreateTaskReq) => createTask(projectId, req),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] })
    },
  })
}
```

**规则：**
- 每个 API 查询封装为自定义 hook（`useTasks`、`useProjects`）
- queryKey 使用 `[resource, ...params]` 格式
- 变更操作必须 invalidate 相关查询
- 禁止在 useEffect 中手动调用 API + setState（用 React Query 代替）

### 6.4 Toast 通知

```tsx
import { useToast } from "@/context/ToastContext"

const { toast } = useToast()

// API 错误统一通过 Toast 提示
try {
  await createTask(projectId, req)
  toast({ title: "任务创建成功" })
} catch (error) {
  toast({ title: "创建失败，请稍后重试", variant: "destructive" })
}
```

---

## 7. 状态管理规范

### 7.1 状态分层

```
┌──────────────────────────────────┐
│  URL 状态 (useParams, useSearchParams)      │  ← 页面级状态放 URL
├──────────────────────────────────┤
│  服务端状态 (React Query)            │  ← API 数据用 React Query
├──────────────────────────────────┤
│  应用级状态 (Context)                │  ← Auth, Toast, Theme
├──────────────────────────────────┤
│  组件局部状态 (useState/useReducer)  │  ← 表单状态、UI 开关
└──────────────────────────────────┘
```

### 7.2 Context 使用规范

```tsx
// ✅ 正确模式：AuthContext 参考实现
// context/AuthContext.tsx

// 1. 定义 context value 类型（不导出）
interface AuthContextValue {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  // ...
}

// 2. 创建 context
const AuthContext = createContext<AuthContextValue | null>(null)

// 3. 导出 Provider
export function AuthProvider({ children }: { children: ReactNode }) {
  // ... 状态和处理函数
}

// 4. 导出 hook（含 null 检查）
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
```

**规则：**
- Context **仅用于**：认证状态、Toast 通知、主题切换
- **禁止**将 API 数据写入 Context — 用 React Query
- **禁止**将表单状态写入 Context — 用组件局部 state
- Context hook 必须做 null 检查，抛出明确错误信息

### 7.3 数据流方向

```
User Action → Component state → API call → React Query cache → UI update
                  ↑                  ↑
              useAuth()          useQuery / useMutation
              useToast()
```

---

## 8. 路由规范

### 8.1 路由结构

```tsx
<BrowserRouter>
  <AuthProvider>
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* 公开路由 — 已登录用户自动跳转到 /dashboard */}
        <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
        <Route path="/register" element={<GuestRoute><RegisterPage /></GuestRoute>} />

        {/* 受保护路由 — 需要登录，包裹 DashboardLayout */}
        <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
          <Route path="/settings" element={<AccountSettingsPage />} />
        </Route>

        {/* 默认跳转 */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  </AuthProvider>
</BrowserRouter>
```

### 8.2 路由守卫

**ProtectedRoute 三态处理：**
1. `loading === true` → 显示 spinner，防止刷新时误跳转
2. `!isAuthenticated` → 跳转 `/login`，通过 `state.from` 保存来源 URL
3. `authenticated` → 渲染 children

```tsx
// 使用 <Navigate replace> 而非 navigate()，避免浏览器历史污染
if (!isAuthenticated) {
  return <Navigate to="/login" state={{ from: location }} replace />
}
```

### 8.3 懒加载

```tsx
// ✅ 所有页面组件必须懒加载
const DashboardPage = lazy(() => import("@/pages/DashboardPage"))

// ✅ 非标准路径的组件使用 .then() 适配
const LoginPage = lazy(() =>
  import("@/components/ui/animated-characters-login-page")
    .then((m) => ({ default: m.Component }))
)
```

### 8.4 导航

```tsx
// 页面内跳转使用 useNavigate()
const navigate = useNavigate()
navigate(`/projects/${id}`)

// 链接使用 <Link> 组件
<Link to={`/projects/${id}`}>查看项目</Link>
```

---

## 9. 动画规范

### 9.1 动画方案选择

| 场景 | 方案 | 示例 |
|------|------|------|
| 页面过渡/路由切换 | CSS animation + suspense | 页面加载 skeleton |
| 组件进场/退场 | CSS transition + conditional class | 抽屉滑入、模态框淡入 |
| 微交互（hover/active） | `transition-all duration-200` | 按钮悬停、卡片上浮 |
| 复杂动画 | styled-components keyframes | 骨架屏 shimmer、loading 动画 |
| 拖拽动画 | dnd-kit 内置 | 看板拖拽排序 |

### 9.2 Tailwind 动画类

```tsx
// ✅ 过渡 — 使用 Tailwind 原子类
<button className="transition-all duration-200 hover:scale-105 active:scale-95">
  按钮
</button>

// ✅ 骨架屏 — 项目自定义 shimmer 动画
<div className="skeleton-shimmer h-4 w-48 rounded" />

// ✅ 入场动画 — CSS 自定义 + Tailwind
<div className="animate-slide-in-left">
  <Sidebar />
</div>
```

### 9.3 项目内置动画

```css
/* index.css 中已定义的全局动画 */

/* 骨架屏闪光 */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton-shimmer { /* ... */ }

/* 移动端侧边栏滑入 */
@keyframes slide-in-left {
  from { transform: translateX(-100%); }
  to { transform: translateX(0); }
}
.animate-slide-in-left { animation: slide-in-left 0.2s ease-out; }
```

### 9.4 动画约束

- **性能**：只动画 `transform` 和 `opacity`，不动画 `width`/`height`/`padding`/`margin`
- **时长**：微交互 150-200ms，页面过渡 200-300ms
- **缓动**：入场用 `ease-out`，退场用 `ease-in`，hover 用 `ease-in-out`
- **无障碍**：尊重 `prefers-reduced-motion`（暂不强制要求，但新加的全局动画须考虑）
- **dnd-kit**：拖拽动画使用库内置 transition，不自定义覆盖

### 9.5 常见动画模式

```tsx
// 1. 模态框淡入
<div className="animate-in fade-in duration-200">
  <Modal />
</div>

// 2. 卡片 hover 上浮
<div className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg">
  <Card />
</div>

// 3. 按钮点击反馈
<button className="transition-all duration-150 active:scale-95">
  确认
</button>

// 4. 加载态
<div className="flex items-center gap-2">
  <div className="size-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
  <span>加载中...</span>
</div>

// 5. 渐显出现（配合 React 状态）
<div className={cn(
  "transition-opacity duration-200",
  isVisible ? "opacity-100" : "opacity-0"
)} />
```

---

## 10. 设计 Token 速查

### 10.1 颜色语义

| Token | 用途 | 不允许的用法 |
|-------|------|------------|
| `primary` / `primary-foreground` | 主要操作按钮、强调文字 | 正文、普通卡片 |
| `secondary` / `secondary-foreground` | 次要操作、标签 | 替代 primary |
| `muted` / `muted-foreground` | 弱化信息、说明文字 | 正文（对比度不足） |
| `destructive` | 删除、危险操作 | 非破坏性操作 |
| `accent` / `accent-foreground` | hover 高亮、选中态 | 普通状态 |
| `background` / `foreground` | 页面背景、正文 | 卡片（用 card） |
| `border` / `input` / `ring` | 边框、输入框、焦点环 | 装饰（用 accent） |

### 10.2 圆角 Tokens

| Token | 值 | 使用场景 |
|-------|-----|---------|
| `--radius-sm` | calc(--radius - 4px) ≈ 6px | 紧凑元素、tag |
| `--radius-md` | calc(--radius - 2px) ≈ 8px | 输入框、下拉菜单 |
| `--radius-lg` | 0.625rem = 10px | 卡片、模态框 |
| `--radius-xl` | calc(--radius + 4px) ≈ 14px | 大卡片 |

### 10.3 间距约定

- 基础间距单元：4px（Tailwind 默认 `p-1` = 4px）
- 推荐间距：`gap-2`(8px) / `gap-4`(16px) / `gap-6`(24px) / `gap-8`(32px)
- 页面内边距：`p-6` 或 `px-8`

### 10.4 玻璃拟态

暗色模式下使用半透明背景配合模糊：

```css
/* 玻璃卡片 */
.backdrop-blur-md      /* 模糊量 */
.bg-card/30            /* 30% 透明度的背景色 */
.border-border/50      /* 50% 透明度的边框 */
```

---

## 11. 常见模式速查

### 11.1 列表 + 分页

```tsx
function usePaginatedList(projectId: string) {
  const [page, setPage] = useState(1)
  const { data, isLoading } = useQuery({
    queryKey: ["resource", projectId, page],
    queryFn: () => listResource(projectId, { page, page_size: 20 }),
  })
  return { data, page, setPage, isLoading }
}
```

### 11.2 模态框

```tsx
// 使用 Radix Dialog/AlertDialog 作为基础
// 状态管理用组件内部 state
function CreateTaskModal({ open, onClose, projectId }: Props) {
  // ...
}
```

### 11.3 抽屉侧边栏

```tsx
// 固定定位 + 遮罩 + 过渡动画
// 参考项目已有的 TaskDetailDrawer 实现模式
```

### 11.4 拖拽排序

```tsx
// 使用 dnd-kit
import { DndContext, closestCenter } from "@dnd-kit/core"
import { SortableContext, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
// 参考项目已有的 SortableTaskCard 实现
```

### 11.5 表单验证

```tsx
// Radix UI Form 组件 + 服务端错误映射
// useMutation error → field error state
```

---

## 12. 代码检查清单

每个 PR 前端代码变更必须通过以下检查：

### 结构
- [ ] 文件放在正确的目录下
- [ ] 使用 `@/` 别名，无相对路径引用

### 类型
- [ ] 类型导入使用 `import type { ... }`
- [ ] 没有 `any` 类型（除非明确标注原因）
- [ ] 没有未使用的变量/参数

### 样式
- [ ] 颜色使用 CSS 变量 token，无硬编码值
- [ ] 使用 `cn()` 或 `cva` 合并类名，无字符串拼接
- [ ] 检查暗色模式下的表现
- [ ] 玻璃拟态效果使用正确的透明度

### API
- [ ] API 调用通过 `api/` 模块函数，不直接调用 `api.get/post()`
- [ ] 查询使用 React Query，不在 useEffect 中手动请求
- [ ] 错误有 Toast 提示

### 状态
- [ ] Context 不滥用（只用于 Auth/Toast）
- [ ] 组件局部状态使用 `useState`

### 性能
- [ ] 页面组件使用 `lazy()` 懒加载
- [ ] 动画只使用 `transform` + `opacity`

---

## 13. 参考文件

编写代码时以下文件是最好的参考：

| 文件 | 参考内容 |
|------|---------|
| `src/components/ui/button.tsx` | UI 组件标准模板 |
| `src/context/AuthContext.tsx` | Context + Provider + Hook 模式 |
| `src/api/task.ts` | API 模块组织方式 |
| `src/api/client.ts` | Axios 客户端配置 |
| `src/App.tsx` | 路由结构 + 懒加载 |
| `src/components/ProtectedRoute.tsx` | 路由守卫三态模式 |
| `src/index.css` | 全局 CSS 变量 + 动画定义 |
| `src/components/showcase/Form.tsx` | styled-components 展示组件模式 |
