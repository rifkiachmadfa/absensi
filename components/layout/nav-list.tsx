"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/constants/nav"
import type { UserRole } from "@/app/generated/prisma/enums"

type NavVariant = "sidebar" | "sheet"

export function NavList({
  role,
  onNavigate,
  variant = "sheet",
}: {
  role: UserRole
  onNavigate?: () => void
  variant?: NavVariant
}) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))
  const isSidebar = variant === "sidebar"

  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
        const isActive =
          item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)

        if (item.comingSoon) {
          return (
            <span
              key={item.href}
              aria-disabled="true"
              className={cn(
                "flex cursor-not-allowed items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm font-medium",
                isSidebar ? "text-sidebar-foreground/40" : "text-muted-foreground/50"
              )}
            >
              <item.icon className="size-5 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                  isSidebar
                    ? "bg-sidebar-accent text-sidebar-foreground/70"
                    : "bg-muted text-muted-foreground"
                )}
              >
                Segera
              </span>
            </span>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-2.5 rounded-[10px] border-l-2 border-transparent px-3 py-2 text-sm font-medium transition-colors",
              isSidebar
                ? isActive
                  ? "border-l-sidebar-primary bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                : isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon
              className={cn(
                "size-5 shrink-0",
                isSidebar && isActive && "text-sidebar-primary"
              )}
            />
            <span className="flex-1 truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}