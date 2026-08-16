"use client";

import { useTransition } from "react";
import { LogOut, User as UserIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/auth/actions";
import type { UserRole } from "@/app/generated/prisma/client";

const ROLE_LABEL: Record<UserRole, string> = {
  SUPERADMIN: "Super Admin",
  ADMIN: "Admin",
  GURU: "Guru",
  WALI_KELAS: "Wali Kelas",
};

function getInitials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function UserNav({
  name,
  email,
  role,
}: {
  name: string;
  email: string;
  role: UserRole;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="flex items-center gap-2 px-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback>{getInitials(name)}</AvatarFallback>
            </Avatar>
            <span className="hidden text-sm font-medium sm:inline">
              {name}
            </span>
          </Button>
        }
      />

        <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
            <DropdownMenuLabel className="flex flex-col gap-1">
            <span className="flex items-center gap-2 text-sm font-medium">
                <UserIcon className="h-3.5 w-3.5" />
                {name}
            </span>
            <span className="truncate text-xs font-normal text-muted-foreground">
                {email}
            </span>
            <Badge variant="secondary" className="w-fit text-xs">
                {ROLE_LABEL[role]}
            </Badge>
            </DropdownMenuLabel>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
            disabled={isPending}
            onClick={() => startTransition(() => logoutAction())}
            className="text-destructive focus:text-destructive"
        >
{isPending ? <Spinner className="mr-2" /> : <LogOut className="mr-2 h-4 w-4" />}
            {isPending ? "Keluar..." : "Keluar"}
        </DropdownMenuItem>
        </DropdownMenuContent>
    </DropdownMenu>
  );
}