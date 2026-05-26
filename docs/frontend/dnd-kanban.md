# @dnd-kit Drag & Drop — Kanban Implementation

DevOS 使用 `@dnd-kit` 库实现看板（Kanban）拖拽功能，支持任务在状态列之间拖拽移动。

---

## 1. 库选型

| 库 | 优点 | 缺点 |
|---|---|---|
| `@dnd-kit` | 现代 API、支持触摸、性能好、可定制 | 学习曲线稍高 |
| `react-beautiful-dnd` | API 简单、动画流畅 | 已停止维护 |
| `react-dnd` | 灵活、底层控制强 | 样板代码多 |

**项目依赖：**
```json
{
  "@dnd-kit/core": "^6.3.1",
  "@dnd-kit/sortable": "^10.0.0",
  "@dnd-kit/utilities": "^3.2.2"
}
```

---

## 2. 核心概念

### @dnd-kit 的三个核心类型

| 概念 | 说明 | Hook / Component |
|------|------|------------------|
| **Droppable** | 可以接收拖放的区域 | `useDroppable` |
| **Draggable** | 可以被拖拽的元素 | `useDraggable` |
| **Sortable** | 既可拖拽又可排序 | `useSortable`（= Draggable + Droppable） |

### 事件流

```
onDragStart → 记录被拖元素
onDragOver  → 拖拽过程中（可选，用于实时反馈）
onDragEnd   → 确定最终位置，执行业务逻辑
```

---

## 3. 架构设计

```
TaskKanban (DndContext)
  ├── Column (SortableContext + DroppableColumn)
  │     ├── SortableTaskCard (useSortable)
  │     ├── SortableTaskCard (useSortable)
  │     └── ... (空列也有 Droppable 区域)
  ├── Column
  │     └── ...
  └── DragOverlay (拖拽时的浮动副本)
```

---

## 4. 关键实现

### 4.1 DndContext 配置

```tsx
// TaskKanban.tsx

<DndContext
  sensors={sensors}                          // 传感器配置
  collisionDetection={closestCorners}         // 碰撞检测算法
  onDragStart={handleDragStart}              // 拖拽开始
  onDragEnd={handleDragEnd}                  // 拖拽结束
>
```

**碰撞检测算法选择：**

| 算法 | 特点 | 适用场景 |
|------|------|----------|
| `closestCorners` | 找最近的可拖放区域角 | 看板（列之间距离近） |
| `closestCenter` | 找最近的中心点 | 列表排序 |
| `pointerWithin` | 指针必须进入区域 | 精确放置 |
| `rectIntersection` | 矩形交集 | 一般场景 |

**为什么用 `closestCorners`？**
- 看板列宽度固定，列之间间距小
- 拖到空列时，`closestCorners` 能匹配到列的四个角
- 比 `closestCenter` 对空列更友好

### 4.2 传感器配置

```tsx
const sensors = useSensors(
  useSensor(PointerSensor, {
    activationConstraint: { distance: 5 }  // 移动 5px 后才激活拖拽
  })
)
```

**`activationConstraint` 的作用：**
- 防止点击误触发拖拽
- `distance: 5` 表示鼠标移动 5 像素后才进入拖拽模式
- 也可以用 `delay: { ms: 200 }` 实现长按触发

### 4.3 空列可拖放（关键修复）

```tsx
// DroppableColumn — 让空列也能接收拖放
function DroppableColumn({ colId, children }: { colId: string; children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: colId })
  return (
    <div ref={setNodeRef} className="min-h-50 rounded-lg bg-muted/30 p-2 space-y-2">
      {children}
    </div>
  )
}
```

**为什么空列需要 `useDroppable`？**

@dnd-kit 的 `closestCorners` 算法只能匹配**已注册的 Droppable 节点**：
- 空列没有 `SortableTaskCard` → `useSortable` 不注册 → 没有可匹配的目标
- 添加 `useDroppable({ id: colId })` 注册列容器本身作为拖放目标
- `min-h-50` 确保空列有足够的拖放区域

### 4.4 可排序卡片

```tsx
// SortableTaskCard.tsx
function SortableTaskCard({ task, disabled, onClick }: Props) {
  const {
    attributes,     // ARIA 无障碍属性
    listeners,      // 事件监听器
    setNodeRef,     // 节点引用
    transform,      // 位移变换
    transition,     // 过渡动画
    isDragging,     // 是否正在拖拽
  } = useSortable({
    id: task.id,
    disabled: disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick}>
      {/* 卡片内容 */}
    </div>
  )
}
```

**`useSortable` 返回值：**
- `attributes` + `listeners` — 必须绑定到 DOM，提供拖拽交互
- `transform` — 实时位移，用于视觉反馈
- `isDragging` — 拖拽中降低透明度

### 4.5 拖拽结束处理

```tsx
const handleDragEnd = async (event: DragEndEvent) => {
  setActiveId(null)
  setActiveTask(null)
  const { active, over } = event
  if (!over || !canEdit) return

  const taskId = String(active.id)
  const overId = String(over.id)

  // 场景 1：拖到列（空列或列区域）
  const targetColumn = columns.find((c) => c.id === overId)
  if (targetColumn) {
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.status !== targetColumn.id) {
      await updateTask(projectId, taskId, { status: targetColumn.id })
      toast.success(`Task moved to ${targetColumn.label}`)
      onRefresh()
    }
    return
  }

  // 场景 2：拖到某个卡片上 → 移到该卡片所在的列
  const targetTask = tasks.find((t) => t.id === overId)
  if (targetTask && targetTask.id !== taskId) {
    const task = tasks.find((t) => t.id === taskId)
    if (task && task.status !== targetTask.status) {
      await updateTask(projectId, taskId, { status: targetTask.status })
      toast.success("Task moved")
      onRefresh()
    }
  }
}
```

### 4.6 DragOverlay（拖拽浮层）

```tsx
<DragOverlay>
  {activeTask ? (
    <div className="bg-card border rounded-md p-3 shadow-lg">
      {/* 拖拽时显示的卡片副本 */}
      <span>{activeTask.title}</span>
    </div>
  ) : null}
</DragOverlay>
```

**`DragOverlay` 的作用：**
- 拖拽时在鼠标位置渲染一个浮层
- 不影响原始 DOM 布局（原始位置可以用半透明占位）
- 可以自定义浮层样式（项目用简化版卡片）

---

## 5. 排序策略

```tsx
<SortableContext
  id={col.id}
  items={colTasks.map((t) => t.id)}
  strategy={verticalListSortingStrategy}
>
```

| 策略 | 适用场景 |
|------|----------|
| `verticalListSortingStrategy` | 垂直列表排序 |
| `horizontalListSortingStrategy` | 水平列表排序 |
| `rectSortingStrategy` | 网格排序 |

---

## 6. 踩过的坑

### 坑 1：空列不能接收拖放

**症状：** 任务只能拖到有卡片的列，空列拖不进去。

**原因：** `closestCorners` 碰撞检测找不到未注册的 Droppable 节点。空列没有子元素使用 `useSortable`，所以列容器不在碰撞检测的候选列表中。

**修复：** 用 `useDroppable` 手动注册列容器。

### 坑 2：拖拽和点击冲突

**症状：** 点击卡片触发了拖拽。

**修复：** `activationConstraint: { distance: 5 }`，需要移动 5px 才激活拖拽。

### 坑 3：DragOverlay 卡片闪烁

**症状：** 拖拽开始时浮层闪烁。

**原因：** `activeTask` 状态更新和 DragOverlay 渲染不同步。

**修复：** 在 `handleDragStart` 中同步设置 `activeId` 和 `activeTask`。

---

## 7. 面试常见问题

### Q: @dnd-kit 和原生 HTML5 Drag & Drop API 的区别？

**A:**
- **HTML5 DnD** — 浏览器原生，不支持触摸设备，API 基于事件，样式控制有限
- **@dnd-kit** — 基于指针事件，支持触摸和键盘，虚拟 DOM 友好，碰撞检测可定制
- @dnd-kit 在 React 生态中使用更广泛，维护活跃

### Q: 如何实现拖拽排序 + 跨列移动？

**A:**
- 每个列是一个 `SortableContext`（列内排序）
- 列容器用 `useDroppable`（跨列移动）
- `DndContext` 的 `closestCorners` 同时处理列内和列间碰撞
- `onDragEnd` 根据目标 ID 判断是列内排序还是跨列移动

### Q: 如何实现拖拽的动画效果？

**A:**
- `useSortable` 返回 `transform` 和 `transition`
- `transform` 是实时位移（跟随鼠标）
- `transition` 是回弹动画（松手后归位）
- `CSS.Transform.toString(transform)` 转换为 CSS transform 字符串

### Q: 如何优化大量元素的拖拽性能？

**A:**
1. **虚拟化** — 只渲染可见区域的卡片（react-window / react-virtuoso）
2. **碰撞检测优化** — 使用 `pointerWithin` 替代 `closestCorners`（计算量更小）
3. **减少 re-render** — 拖拽过程中用 `DragOverlay` 而不是移动真实 DOM
4. **memo** — 对卡片组件用 `React.memo` 避免无关更新
