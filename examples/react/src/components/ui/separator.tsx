"use client";
// Vendored from the Fragiola UI registry (https://fragiola.com/r/separator.json, source registry/ui/separator.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";
import type * as React from "react";
import { cn } from "#/lib/cn";

// Separator — a visual divider. Uses Base UI's primitive for the ARIA
// (`role="separator"`, `aria-orientation`). No family — the `menu` family
// has a `separator` member, but that one is specific to menu lists (it
// carries the menu's spacing). This separator is generic: `bg-palette-line`
// (a role) + orientation from the primitive.
//
// Horizontal: `h-px w-full`. Vertical: `h-full w-px`. The consumer can
// override the size via className.

function Separator({
    className,
    ...props
}: React.ComponentProps<typeof SeparatorPrimitive>) {
    return (
        <SeparatorPrimitive
            data-slot="separator"
            className={cn(
                "shrink-0 bg-palette-line",
                "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
                "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
                className as string,
            )}
            {...props}
        />
    );
}

export { Separator };
