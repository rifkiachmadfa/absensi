"use client"

import * as React from "react"
import { useFormStatus } from "react-dom"

import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

export function SubmitButton({
  children,
  pendingText = "Memproses...",
  className,
  ...props
}: React.ComponentProps<typeof Button> & { pendingText?: string }) {
  const { pending } = useFormStatus()

  return (
    <Button type="submit" disabled={pending} className={cn(className)} {...props}>
      {pending && <Spinner />}
      {pending ? pendingText : children}
    </Button>
  )
}