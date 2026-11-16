// Vue port of the Fragiola UI context menu (examples/react/src/components/ui/context-menu.tsx):
// the same parts, classes and palette roles, over Reka UI's ContextMenu. The shared parts come
// from the menu family (`createMenuParts`). The trigger takes `as-child` to put the right-click
// (and long press) on your own element, a grid cell for example, where the React kit uses
// `render`. An item's action is `@select`.

import {
    ContextMenuCheckboxItem,
    ContextMenuContent as ContextMenuContentPrimitive,
    ContextMenuGroup,
    ContextMenuItem,
    ContextMenuItemIndicator,
    ContextMenuLabel,
    ContextMenuPortal,
    ContextMenuRadioGroup,
    ContextMenuRadioItem,
    ContextMenuRoot as ContextMenuRootPrimitive,
    ContextMenuSeparator,
    ContextMenuSub,
    ContextMenuSubContent,
    ContextMenuSubTrigger,
    ContextMenuTrigger as ContextMenuTriggerPrimitive,
    injectContextMenuRootContext,
} from "reka-ui";
import { defineComponent, h } from "vue";
import { createMenuParts } from "#/components/families/menu/parts";
import { cn } from "#/lib/cn";

const parts = createMenuParts(
    {
        Item: ContextMenuItem,
        CheckboxItem: ContextMenuCheckboxItem,
        ItemIndicator: ContextMenuItemIndicator,
        RadioGroup: ContextMenuRadioGroup,
        RadioItem: ContextMenuRadioItem,
        Group: ContextMenuGroup,
        Label: ContextMenuLabel,
        Separator: ContextMenuSeparator,
        Sub: ContextMenuSub,
        SubTrigger: ContextMenuSubTrigger,
        SubContent: ContextMenuSubContent,
        Portal: ContextMenuPortal,
        Content: ContextMenuContentPrimitive,
    },
    () => injectContextMenuRootContext(),
);

const ContextMenuRoot = defineComponent({
    name: "ContextMenuRoot",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                ContextMenuRootPrimitive,
                { "data-slot": "context-menu", ...attrs },
                slots,
            );
    },
});

const ContextMenuTrigger = defineComponent({
    name: "ContextMenuTrigger",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                ContextMenuTriggerPrimitive,
                {
                    "data-slot": "context-menu-trigger",
                    ...attrs,
                    class: cn("select-none", attrs.class as string),
                },
                slots,
            );
    },
});

const ContextMenuContent = defineComponent({
    name: "ContextMenuContent",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                parts.Content,
                {
                    "data-slot": "context-menu-content",
                    ...attrs,
                    style: {
                        "--available-height":
                            "var(--reka-context-menu-content-available-height)",
                        "--transform-origin":
                            "var(--reka-context-menu-content-transform-origin)",
                    },
                },
                slots,
            );
    },
});

export const ContextMenu = {
    ...parts,
    Root: ContextMenuRoot,
    Trigger: ContextMenuTrigger,
    Content: ContextMenuContent,
};
