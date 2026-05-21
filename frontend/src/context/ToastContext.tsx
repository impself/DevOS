import {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"

interface ToastItem {
  id: string
  title: string
  description?: string
  variant: "default" | "success" | "error" | "info"
}

interface ToastContextValue {
  toast: {
    success: (msg: string, description?: string) => void
    error: (msg: string, description?: string) => void
    info: (msg: string, description?: string) => void
  }
}

const ToastContext = createContext<ToastContextValue | null>(null)

let toastCounter = 0

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  const addToast = useCallback(
    (variant: ToastItem["variant"], title: string, description?: string) => {
      const id = `toast-${++toastCounter}`
      setToasts((prev) => [...prev, { id, title, description, variant }])
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 4000)
    },
    [],
  )

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Stable reference — prevents infinite re-render loop in consumers
  const toastValue = useMemo<ToastContextValue["toast"]>(
    () => ({
      success: (msg: string, desc?: string) => addToast("success", msg, desc),
      error: (msg: string, desc?: string) => addToast("error", msg, desc),
      info: (msg: string, desc?: string) => addToast("info", msg, desc),
    }),
    [addToast],
  )

  const contextValue = useMemo<ToastContextValue>(
    () => ({ toast: toastValue }),
    [toastValue],
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <ToastPrimitive.Provider swipeDirection="right">
        {toasts.map((t) => (
          <Toast
            key={t.id}
            variant={t.variant}
            open
            onOpenChange={(open) => {
              if (!open) dismiss(t.id)
            }}
          >
            <div className="grid gap-1">
              <ToastTitle>{t.title}</ToastTitle>
              {t.description && (
                <ToastDescription>{t.description}</ToastDescription>
              )}
            </div>
            <ToastClose />
          </Toast>
        ))}
        <ToastViewport />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}
