"use client"

import * as React from "react"
import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox"
import { CheckIcon, MinusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  indeterminate,
  ...props
}: CheckboxPrimitive.Root.Props & { indeterminate?: boolean }) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      indeterminate={indeterminate}
      className={cn(
        // Kotak checkbox: border lebih tegas (bukan --border yang terlalu pucat)
        // supaya jelas terlihat di background putih, sesuai UI_RULES §32
        // (jangan mengandalkan kontras yang lemah untuk elemen interaktif).
        "peer relative flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-[6px] border-2 border-muted-foreground/45 bg-background shadow-xs outline-none transition-colors",
        // Target sentuh diperluas ke ~44x44px lewat pseudo-element tak terlihat
        // (UI_RULES §21: touch target minimal 44x44px), tanpa mengubah ukuran
        // visual kotak itu sendiri.
        "before:absolute before:-inset-3 before:content-['']",
        "hover:border-primary",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "data-[checked]:border-primary data-[checked]:bg-primary data-[checked]:text-primary-foreground",
        "data-[indeterminate]:border-primary data-[indeterminate]:bg-primary data-[indeterminate]:text-primary-foreground",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current"
      >
        {indeterminate ? (
          <MinusIcon className="size-4 stroke-[3]" />
        ) : (
          <CheckIcon className="size-4 stroke-[3]" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }