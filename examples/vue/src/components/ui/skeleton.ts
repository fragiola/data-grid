// Vue port of the Fragiola UI skeleton (examples/react/src/components/ui/skeleton.tsx): a
// placeholder for loading content, the same classes and palette role. No primitive.

import { defineComponent, h } from "vue";
import { cn } from "#/lib/cn";

export const Skeleton = defineComponent({
    name: "Skeleton",
    inheritAttrs: false,
    setup(_, { attrs, slots }) {
        return () =>
            h(
                "div",
                {
                    "data-slot": "skeleton",
                    ...attrs,
                    class: cn(
                        "animate-pulse rounded-md bg-palette-soft",
                        attrs.class as string,
                    ),
                },
                slots.default?.(),
            );
    },
});
