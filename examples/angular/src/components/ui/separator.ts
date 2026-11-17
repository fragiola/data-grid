// Angular port of the Fragiola UI separator (examples/react/src/components/ui/separator.tsx): the
// same classes and palette role, on your own element, with Base UI's ARIA (`role="separator"`,
// `aria-orientation`) and its `data-orientation`.
//
//     <div kitSeparator orientation="vertical"></div>

import { computed, Directive, input } from "@angular/core";
import { cn } from "#/lib/cn";

@Directive({
    selector: "[kitSeparator]",
    host: {
        role: "separator",
        "data-slot": "separator",
        "[attr.aria-orientation]": "orientation()",
        "[attr.data-orientation]": "orientation()",
        "[class]": "classes()",
    },
})
export class Separator {
    readonly orientation = input<"horizontal" | "vertical">("horizontal");
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(
            "shrink-0 bg-palette-line",
            "data-[orientation=horizontal]:h-px data-[orientation=horizontal]:w-full",
            "data-[orientation=vertical]:h-full data-[orientation=vertical]:w-px",
            this.class(),
        ),
    );
}
