import * as React from "react"
import { cn } from "@/lib/utils"

interface CheckboxProps {
  checked?: boolean | "indeterminate"
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
  className?: string
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ checked, onCheckedChange, disabled, className }, ref) => {
    const isChecked = checked === true || checked === "indeterminate"

    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={isChecked}
        disabled={disabled}
        ref={ref as React.Ref<HTMLButtonElement>}
        className={cn(
          "peer h-4 w-4 shrink-0 rounded-sm border border-input",
          "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "transition-all duration-150 cursor-pointer",
          isChecked && "bg-primary border-primary",
          className,
        )}
        onClick={() => onCheckedChange?.(!isChecked)}
      >
        {isChecked && (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "size-3 text-primary-foreground mx-auto",
              "animate-in fade-in zoom-in-50 duration-150",
            )}
          >
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </button>
    )
  },
)
Checkbox.displayName = "Checkbox"

export { Checkbox }
