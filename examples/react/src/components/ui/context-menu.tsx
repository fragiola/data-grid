"use client";
// Vendored from the Fragiola UI registry (https://fragiola.com/r/context-menu.json, source registry/ui/context-menu.tsx). Do not edit: re-run scripts/vendor-fragiola.ts.

import { ContextMenu as ContextMenuPrimitive } from "@base-ui/react/context-menu";
import type * as React from "react";
import { createMenuParts } from "#/components/families/menu/parts";
import { cn } from "#/lib/cn";

const parts = createMenuParts(ContextMenuPrimitive);

function ContextMenuRoot({ ...props }: ContextMenuPrimitive.Root.Props) {
    return <ContextMenuPrimitive.Root data-slot="context-menu" {...props} />;
}

function ContextMenuTrigger({
    className,
    ...props
}: ContextMenuPrimitive.Trigger.Props) {
    return (
        <ContextMenuPrimitive.Trigger
            data-slot="context-menu-trigger"
            // select-none is behavioural (stops text selection on right-click),
            // not visual style — it does not come from a family.
            className={cn("select-none", className as string)}
            {...props}
        />
    );
}

function ContextMenuContent({
    align = "start",
    alignOffset = 4,
    side = "right",
    sideOffset = 0,
    ...props
}: ContextMenuPrimitive.Popup.Props &
    Pick<
        ContextMenuPrimitive.Positioner.Props,
        "align" | "alignOffset" | "side" | "sideOffset"
    >) {
    return (
        <parts.Content
            data-slot="context-menu-content"
            align={align}
            alignOffset={alignOffset}
            side={side}
            sideOffset={sideOffset}
            {...props}
        />
    );
}

function ContextMenuSubContent({
    ...props
}: React.ComponentProps<typeof ContextMenuContent>) {
    return (
        <ContextMenuContent
            data-slot="context-menu-sub-content"
            side="right"
            {...props}
        />
    );
}

export const ContextMenu = {
    ...parts,
    Root: ContextMenuRoot,
    Trigger: ContextMenuTrigger,
    Content: ContextMenuContent,
    SubContent: ContextMenuSubContent,
};
