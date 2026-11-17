// Vue port of the Fragiola UI badge atom (examples/react/src/components/atoms/badge/index.tsx): the
// same variants, classes and palette roles, on a `<span>`.

import { tv, type VariantProps } from "tailwind-variants";
import { defineComponent, h, type PropType } from "vue";
import { cn } from "#/lib/cn";

export const badge = tv({
    base: `
        inline-flex items-center rounded-full border px-2.5 py-0.5
        text-xs font-medium transition-colors
        [&_svg:not([class*='size-'])]:size-3
    `,
    variants: {
        variant: {
            soft: "bg-palette-soft text-palette-accent border-transparent",
            solid: "bg-palette-base text-palette-contrast border-transparent",
            outline: "bg-transparent text-palette-accent border-palette-line",
        },
    },
    defaultVariants: {
        variant: "soft",
    },
});

type BadgeVariants = VariantProps<typeof badge>;

export const Badge = defineComponent({
    name: "FragiolaBadge",
    inheritAttrs: false,
    props: {
        variant: {
            type: String as PropType<BadgeVariants["variant"]>,
            default: undefined,
        },
    },
    setup(props, { attrs, slots }) {
        return () =>
            h(
                "span",
                {
                    "data-slot": "badge",
                    ...attrs,
                    class: cn(
                        badge({ variant: props.variant }),
                        attrs.class as string,
                    ),
                },
                slots.default?.(),
            );
    },
});
