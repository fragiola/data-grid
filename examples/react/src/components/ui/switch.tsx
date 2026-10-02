"use client";
// Vendored from the Fragiola UI registry (https://fragiola.com/r/switch.json, source registry/ui/switch.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import type * as React from "react";
import { cn } from "#/lib/cn";

// Switch — a toggle. Uses the choice family's root (the track) and control
// (the thumb). Base UI's Switch provides the behaviour.
//
// The choice family root has size-4.5 and rounded-sm; switch overrides to
// w-9 h-5 rounded-full. The thumb is a circle that slides when checked.
// data-checked fills the track with palette-base.

function SwitchRoot({
    className,
    ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
    return (
        <SwitchPrimitive.Root
            data-slot="switch"
            className={cn(
                "field-control inline-flex shrink-0 items-center rounded-full border border-transparent",
                "w-8 h-5 p-0.5",
                "bg-palette-soft data-checked:bg-palette-ring",
                "field-focus:outline-solid field-focus:outline-1 field-focus:outline-offset-1 field-focus:outline-palette-ring",
                "data-disabled:opacity-50 data-disabled:cursor-not-allowed",
                "transition-colors",
                className as string,
            )}
            {...props}
        />
    );
}

function SwitchThumb({
    className,
    ...props
}: React.ComponentProps<typeof SwitchPrimitive.Thumb>) {
    return (
        <SwitchPrimitive.Thumb
            data-slot="switch-thumb"
            className={cn(
                "block size-4 rounded-full bg-palette-ring transition-transform data-checked:translate-x-3 data-checked:bg-palette-base",
                className as string,
            )}
            {...props}
        />
    );
}

export const Switch = {
    Root: SwitchRoot,
    Thumb: SwitchThumb,
};
