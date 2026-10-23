import type { ReactNode } from "react";

/**
 * WIDSP is strictly light-mode-only.
 * Retained as a pass-through wrapper so any legacy imports remain type-safe
 * without injecting dark-mode classes or system-preference listeners.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}