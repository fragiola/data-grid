// Vue port of the Fragiola UI separator (examples/react/src/components/ui/separator.tsx): the same
// classes and palette role, over Reka UI's Separator (`role="separator"`, `data-orientation`).

import { Separator as SeparatorPrimitive } from "reka-ui";
import { defineComponent, h } from "vue";
import { cn } from "#/lib/cn";

export const Separator = defineComponent({
    name: "Separator",
    inheritAttrs: false,
    setup(_, { attrs }) {
        return () =>
            h(SeparatorPrimitive, {
                "data-slot": "separator",
                ...attrs,
                class: cn(
                    "shrink-0 bg-palette-line",
                    "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
                    "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
                    attrs.class as string,
                ),
            });
    },
});
