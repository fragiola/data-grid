// Angular port of the Fragiola UI clickable atom (examples/react/src/components/atoms/clickable/index.tsx):
// the same variants, classes and palette roles, as a directive on your own native `<button>` (Base
// UI's Button renders one too); `variant`, `size`, `shape` and `disabled` are its inputs.
//
//     <button kitClickable variant="ghost" size="sm" (click)="discard()">Don't save</button>

import { booleanAttribute, computed, Directive, input } from "@angular/core";
import { tv, type VariantProps } from "tailwind-variants";
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

@Directive({
    selector: "button[kitClickable]",
    host: {
        type: "button",
        "data-slot": "clickable-button",
        "[disabled]": "disabled()",
        "[class]": "classes()",
    },
})
export class ClickableButton {
    readonly variant = input<ClickableVariants["variant"]>();
    readonly size = input<ClickableVariants["size"]>();
    readonly shape = input<ClickableVariants["shape"]>();
    readonly disabled = input(false, { transform: booleanAttribute });
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(
            clickable({
                variant: this.variant(),
                size: this.size(),
                shape: this.shape(),
                disabled: this.disabled() || undefined,
            }),
            this.class(),
        ),
    );
}
