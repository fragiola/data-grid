// Angular port of the Fragiola UI badge atom (examples/react/src/components/atoms/badge/index.tsx):
// the same variants, classes and palette roles, as a directive on your own `<span>`.
//
//     <span kitBadge variant="solid">3</span>

import { computed, Directive, input } from "@angular/core";
import { tv, type VariantProps } from "tailwind-variants";
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

@Directive({
    selector: "[kitBadge]",
    host: { "data-slot": "badge", "[class]": "classes()" },
})
export class Badge {
    readonly variant = input<BadgeVariants["variant"]>();
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(badge({ variant: this.variant() }), this.class()),
    );
}
