"use client";
// Vendored from the Fragiola UI registry (https://fragiola.com/r/avatar.json, source registry/ui/avatar.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import { Avatar as AvatarPrimitive } from "@base-ui/react/avatar";
import type * as React from "react";
import { cn } from "#/lib/cn";

// Avatar — a profile picture with a fallback. Uses Base UI's primitive for
// the loading-status state machine (idle → loading → loaded → error). No
// family, no new style — just palette roles and layout.
//
// The root is `inline-flex` with `overflow-hidden` and `rounded-full`. The
// image fills the root. The fallback is centred text on `bg-palette-soft`.
// The size is controlled by the consumer via className (default `size-10`).
//
// `data-[status=loading]` and `data-[status=error]` come from the primitive.
// The image fades in on load; the fallback is visible until the image loads.

function AvatarRoot({
    className,
    ...props
}: React.ComponentProps<typeof AvatarPrimitive.Root>) {
    return (
        <AvatarPrimitive.Root
            data-slot="avatar"
            className={cn(
                "relative flex size-10 shrink-0 overflow-hidden rounded-full",
                className as string,
            )}
            {...props}
        />
    );
}

function AvatarImage({
    className,
    ...props
}: React.ComponentProps<typeof AvatarPrimitive.Image>) {
    return (
        <AvatarPrimitive.Image
            data-slot="avatar-image"
            className={cn(
                "aspect-square size-full object-cover",
                "data-[starting-style]:animate-in data-[starting-style]:fade-in-0",
                className as string,
            )}
            {...props}
        />
    );
}

function AvatarFallback({
    className,
    ...props
}: React.ComponentProps<typeof AvatarPrimitive.Fallback>) {
    return (
        <AvatarPrimitive.Fallback
            data-slot="avatar-fallback"
            className={cn(
                "absolute inset-0 flex size-full items-center justify-center rounded-full bg-palette-soft text-sm font-medium text-palette-contrast",
                className as string,
            )}
            {...props}
        />
    );
}

export const Avatar = {
    Root: AvatarRoot,
    Image: AvatarImage,
    Fallback: AvatarFallback,
};
