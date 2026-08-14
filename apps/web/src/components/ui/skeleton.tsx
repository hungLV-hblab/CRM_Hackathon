import * as React from "react"

import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      // `rounded-control`, not the CLI's `rounded-md`: the project declares exactly three
      // radii and `rounded-md` is a fourth one nobody chose. `bg-ink-200` rather than the
      // `bg-accent` alias (ink-100) — one step of grey off the ink-50 page background is a
      // pulse you have to look for, and a loading state you have to look for is not one.
      className={cn("animate-pulse rounded-control bg-ink-200", className)}
      {...props}
    />
  )
}

export { Skeleton }
