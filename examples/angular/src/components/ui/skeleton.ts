// Angular port of the Fragiola UI skeleton (examples/react/src/components/ui/skeleton.tsx): a
// placeholder for loading content, the same classes and palette role, on your own element.
//
//     <div kitSkeleton class="h-4 w-24"></div>

import { computed, Directive, input } from "@angular/core";
import { cn } from "#/lib/cn";

@Directive({
    selector: "[kitSkeleton]",
    host: { "data-slot": "skeleton", "[class]": "classes()" },
})
export class Skeleton {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn("animate-pulse rounded-md bg-palette-soft", this.class()),
    );
}
