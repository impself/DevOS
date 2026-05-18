import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

// cn merges Tailwind class names safely — handles conditional classes and deduplication
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
