"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { NAV_ITEMS } from "@/lib/constants/nav"
import type { UserRole } from "@/app/generated/prisma/enums"

export function NavList({
  role,
  onNavigate,
}: {
  role: UserRole
  onNavigate?: () => void
}) {
  const pathname = usePathname()
  const items = NAV_ITEMS.filter((item) => item.roles.includes(role))

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
              className="flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground/50"
            >
              <item.icon className="size-5 shrink-0" />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
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
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <item.icon className="size-5 shrink-0" />
            <span className="flex-1 truncate">{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}