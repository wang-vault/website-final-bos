"use client";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui";

export function ThemeToggle() {
  function toggle(): void {
    const root = document.documentElement;
    const dark = !root.classList.contains("dark");
    root.classList.toggle("dark", dark);
    localStorage.setItem("wangstore-theme", dark ? "dark" : "light");
  }
  return <Button type="button" variant="ghost" size="sm" onClick={toggle} aria-label="Ganti tema"><Sun className="h-4 w-4 dark:hidden"/><Moon className="hidden h-4 w-4 dark:block"/><span className="sr-only">Ganti tema</span></Button>;
}
