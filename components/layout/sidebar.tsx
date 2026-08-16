"use client"

import { NavList } from "./nav-list"
import type { UserRole } from "@/app/generated/prisma/enums"

export function Sidebar({ role }: { role: UserRole }) {
  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-60 shrink-0 overflow-y-auto border-r border-border bg-sidebar px-3 py-4 lg:block">
      <NavList role={role} />
    </aside>
  )
}