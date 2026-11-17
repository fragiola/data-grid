// Vue port of the Fragiola UI clickable atom (examples/react/src/components/atoms/clickable/index.tsx):
// the same variants, classes and palette roles. `Clickable.Button` is a native `<button>` (Base UI's
// Button renders one too); `variant`, `size`, `shape` and `disabled` are its props.

import { tv, type VariantProps } from "tailwind-variants";
import { defineComponent, h, type PropType } from "vue";
import { cn } from "#/lib/cn";

export const clickable = tv({
    base: `
        inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md
        text-sm font-medium transition-colors
        focus-visible:outline-2 focus-visible:outline-palette-ring
        [&_svg:not([class*='size-'])]:size-4
    `,
    variants: {
        variant: {
            solid: "bg-palette-base text-palette-contrast hover:bg-palette-base-hover",
            ghost: "bg-transparent text-palette-accent hover:bg-palette-soft",
            outline:
                "border border-palette-line bg-transparent text-palette-accent hover:bg-palette-soft",
            icon: "bg-transparent text-palette-accent hover:bg-palette-soft",
        },
        size: {
            xs: "h-4 px-2",
            sm: "h-8 px-3",
            md: "h-control px-4",
        },
        shape: {
            auto: "",
            square: "px-0 aspect-square",
        },
        disabled: {
            true: "pointer-events-none opacity-50 **:pointer-events-none",
        },
    },
    defaultVariants: {
        variant: "solid",
        size: "md",
        shape: "auto",
    },
});

type ClickableVariants = VariantProps<typeof clickable>;

const Button = defineComponent({
    name: "ClickableButton",
    inheritAttrs: false,
    props: {
        variant: {
            type: String as PropType<ClickableVariants["variant"]>,
            default: undefined,
        },
        size: {
            type: String as PropType<ClickableVariants["size"]>,
            default: undefined,
        },
        shape: {
            type: String as PropType<ClickableVariants["shape"]>,
            default: undefined,
        },
        disabled: { type: Boolean, default: false },
    },
    setup(props, { attrs, slots }) {
        return () =>
            h(
                "button",
                {
                    type: "button",
                    "data-slot": "clickable-button",
                    ...attrs,
                    disabled: props.disabled,
                    class: cn(
                        clickable({
                            variant: props.variant,
                            size: props.size,
                            shape: props.shape,
                            disabled: props.disabled || undefined,
                        }),
                        attrs.class as string,
                    ),
                },
                slots.default?.(),
            );
    },
});

export const Clickable = { Button };
