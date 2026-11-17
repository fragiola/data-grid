// Angular port of the Fragiola UI text atoms (examples/react/src/components/atoms/text/index.tsx): the
// same classes and palette roles, as directives on your own elements (`<h2 kitTextHeading>`,
// `<p kitText="paragraph">`). Each takes `class`, merged after its own.

import { computed, Directive, input } from "@angular/core";
import { tv } from "tailwind-variants";
import { cn } from "#/lib/cn";

const headingVariants = tv({
    base: "font-semibold text-palette-contrast",
    variants: {
        hierarchy: {
            h1: "text-2xl",
            h2: "text-xl",
            h3: "text-lg",
        },
    },
});

/** The classes secondary text wears. */
export const SECONDARY_TEXT = "text-palette-accent/85";

/** The classes of each text atom. */
export const TEXT = {
    paragraph: "text-palette-contrast text-sm transition-all",
    link: "text-palette-contrast text-sm hover:underline",
    small: "text-palette-contrast text-xs italic",
    label: "text-palette-contrast text-sm font-semibold block",
    error: "palette-danger text-xs",
    strong: "text-palette-contrast text-sm font-semibold",
    highlight: "text-palette-contrast text-sm",
    clickable: "inline text-palette-contrast text-sm hover:underline",
} as const;

/** A heading: its level (`h1` to `h3`) sets its size. */
@Directive({
    selector: "h1[kitTextHeading],h2[kitTextHeading],h3[kitTextHeading]",
    host: { "[class]": "classes()" },
})
export class TextHeading {
    readonly kitTextHeading = input<"h1" | "h2" | "h3" | "">("");
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        headingVariants({
            hierarchy: this.kitTextHeading() || "h1",
            className: this.class(),
        }),
    );
}

/** One of the other atoms, by name (`kitText="label"`). */
@Directive({
    selector: "[kitText]",
    host: { "[class]": "classes()" },
})
export class Text {
    readonly kitText = input.required<keyof typeof TEXT>();
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(TEXT[this.kitText()], this.class()),
    );
}
