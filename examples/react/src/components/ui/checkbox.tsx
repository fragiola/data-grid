"use client";
// Vendored from the Fragiola UI registry (https://fragiola.com/r/checkbox.json, source registry/ui/checkbox.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import { Checkbox as CheckboxPrimitive } from "@base-ui/react/checkbox";
import { CheckIcon } from "lucide-react";
import type * as React from "react";
import { cn } from "#/lib/cn";

// Checkbox — a checkable box. Uses the choice family's root (the box) and
// indicator (the check icon). Base UI's Checkbox provides the behaviour
// (checked/unchecked/indeterminate states, keyboard, aria).
//
// The choice family root has size-4.5 (18px) and rounded-sm. The indicator
// is a CheckIcon at size-3.5 (inherited from the family's svg rule).
//
// No size variant, no tone prop — palette handles tone via className.

function CheckboxRoot({
    className,
    ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            className={cn(
                "field-control size-4 shrink-0 rounded-sm border",
                "border-palette-line bg-palette-soft",
                "data-checked:bg-palette-ring data-checked:border-palette-line data-checked:text-palette-base",
                "field-focus:outline-solid field-focus:outline-1 field-focus:outline-offset-1 field-focus:outline-palette-ring",
                "data-disabled:opacity-50 data-disabled:cursor-not-allowed",
                "transition-colors",
                className as string,
            )}
            {...props}
        />
    );
}

function CheckboxIndicator({
    className,
    ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Indicator>) {
    return (
        <CheckboxPrimitive.Indicator
            data-slot="checkbox-indicator"
            className={cn(
                "grid place-content-center text-current",
                className as string,
            )}
            {...props}
        >
            <CheckIcon className="size-3.5" />
        </CheckboxPrimitive.Indicator>
    );
}

export const Checkbox = {
    Root: CheckboxRoot,
    Indicator: CheckboxIndicator,
};
