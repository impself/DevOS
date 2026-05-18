# shadcn/ui + TailwindCSS v4

## 基础概念

shadcn/ui 不是组件库，是可复制的组件代码集合。你拥有代码完全控制权，不依赖 npm 包更新。底层用 Radix UI 原语 + TailwindCSS 样式 + class-variance-authority (cva) 管理变体。

TailwindCSS v4 采用 CSS-first 配置，用 `@import "tailwindcss"` 和 `@theme` 块替代 JS 配置文件。

## 核心用法

### TailwindCSS v4 配置

```css
/* index.css — 不需要 tailwind.config.js */
@import "tailwindcss";

:root {
  --primary: oklch(0.205 0 0);
  --primary-foreground: oklch(0.985 0 0);
}

@theme inline {
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
}
```

### cn() 工具函数

```typescript
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

- `clsx`: 条件拼接类名
- `twMerge`: 解决 Tailwind 类冲突（如 `px-2 px-4` → `px-4`）

### 组件变体模式（cva）

```typescript
const buttonVariants = cva("base-classes", {
  variants: {
    variant: { default: "...", outline: "...", ghost: "..." },
    size: { default: "...", sm: "...", lg: "..." },
  },
  defaultVariants: { variant: "default", size: "default" },
})
```

## 核心思想 / 设计原理

1. **Copy-paste > npm install**：你拥有代码，可以随意修改
2. **组合 > 继承**：通过 `cn()` 合并类名，通过 cva 管理变体
3. **CSS 变量主题**：所有颜色通过 CSS 变量定义，换主题只需改变量
4. **Radix 原语**：无障碍（a11y）开箱即用，键盘导航、ARIA 属性自动处理

## 常见面试题

**Q1: shadcn/ui 和 Ant Design / MUI 有什么区别？**
A: shadcn 是代码集合不是组件库，你复制代码到项目里完全控制。Ant Design/MUI 是 npm 包，升级依赖，定制性受限于 API 设计。

**Q2: TailwindCSS v4 和 v3 有什么区别？**
A: v4 用 CSS-first 配置（`@theme` 替代 `tailwind.config.js`），零配置内容检测，更快的构建速度。v3 的 `ring-offset-background` 等自定义类不再内置，需要通过 `@theme` 声明。

**Q3: 为什么用 `cn()` 而不是模板字符串拼接类名？**
A: `cn()` 处理条件类、去重、解决 Tailwind 冲突。`twMerge` 确保 `p-2 p-4` 只保留 `p-4`。
