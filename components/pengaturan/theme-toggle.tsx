"use client"

import { useTheme } from "next-themes"
import { Moon, Sun } from "lucide-react"

import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useMounted } from "@/hooks/use-mounted"

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  // Hindari mismatch hydration: server tidak tahu preferensi tema client.
  const mounted = useMounted()

  const isDark = mounted && resolvedTheme === "dark"

  return (
    <div className="flex items-center justify-between rounded-lg border p-4">
      <div className="flex items-center gap-3">
        {isDark ? (
          <Moon className="size-5 text-muted-foreground" />
        ) : (
          <Sun className="size-5 text-muted-foreground" />
        )}
        <div>
          <Label htmlFor="dark-mode-switch" className="text-sm font-medium">
            Mode Gelap
          </Label>
          <p className="text-sm text-muted-foreground">
            Ubah tampilan aplikasi menjadi tema gelap.
          </p>
        </div>
      </div>
      <Switch
        id="dark-mode-switch"
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        disabled={!mounted}
        aria-label="Aktifkan mode gelap"
      />
    </div>
  )
}