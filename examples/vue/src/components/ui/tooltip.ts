// Vue port of the Fragiola UI tooltip (examples/react/src/components/ui/tooltip.tsx): the same
// parts, classes and palette roles (`popup.tooltip`), over Reka UI's Tooltip.
//
// What differs from the React one, and why:
//   - Reka UI needs a provider above every tooltip; Base UI does not. `Tooltip.Root` adds one when
//     none is above it, so a lone tooltip works as in React. `Tooltip.Provider` still groups
//     several (moving between triggers skips the delay), as Base UI's does.
//   - The delay is Base UI's (600 ms), not Reka UI's (700 ms).
//   - `as-child` on the trigger puts its behaviour on your own element (a grid cell, a
//     button), where the React kit uses `render`.
//   - The content teleports to the body of its trigger's document (popout windows).

import {
    injectTooltipProviderContext,
    injectTooltipRootContext,
    TooltipContent as TooltipContentPrimitive,
    TooltipPortal,
    TooltipProvider as TooltipProviderPrimitive,
    TooltipRoot as TooltipRootPrimitive,
    TooltipTrigger as TooltipTriggerPrimitive,
} from "reka-ui";
import { defineComponent, h } from "vue";
import { popup } from "#/components/families/popup";
import { useOwnerBody } from "#/hooks/use-owner-body";
import { cn } from "#/lib/cn";

/** Base UI's default delay before a tooltip opens. */
const DELAY = 600;

const TooltipProvider = defineComponent({
    name: "TooltipProvider",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                TooltipProviderPrimitive,
                { delayDuration: DELAY, ...attrs },
                slots,
            );
    },
});

const TooltipRoot = defineComponent({
    name: "TooltipRoot",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        const provided = injectTooltipProviderContext(null) !== null;
        return () => {
            const root = h(
                TooltipRootPrimitive,
                { "data-slot": "tooltip", ...attrs },
                slots,
            );
            return provided
                ? root
                : h(
                      TooltipProviderPrimitive,
                      { delayDuration: DELAY },
                      { default: () => root },
                  );
        };
    },
});

const TooltipTrigger = defineComponent({
    name: "TooltipTrigger",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                TooltipTriggerPrimitive,
                { "data-slot": "tooltip-trigger", ...attrs },
                slots,
            );
    },
});

const TooltipContent = defineComponent({
    name: "TooltipContent",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        const root = injectTooltipRootContext();
        const to = useOwnerBody(() => root.trigger.value, root.open);
        return () =>
            h(
                TooltipPortal,
                { to: to.value },
                {
                    default: () =>
                        h(
                            TooltipContentPrimitive,
                            {
                                "data-slot": "tooltip-content",
                                sideOffset: 4,
                                ...attrs,
                                class: cn(
                                    popup.tooltip(),
                                    attrs.class as string,
                                ),
                            },
                            slots,
                        ),
                },
            );
    },
});

export const Tooltip = {
    Provider: TooltipProvider,
    Root: TooltipRoot,
    Trigger: TooltipTrigger,
    Content: TooltipContent,
};
