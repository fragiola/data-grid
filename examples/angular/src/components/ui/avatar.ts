// Angular port of the Fragiola UI avatar (examples/react/src/components/ui/avatar.tsx): the same
// parts, classes and palette roles, from native elements. Base UI's loading states, kept by the
// root: the fallback shows until the image has loaded, and again when it fails.
//
//     <span kitAvatar><img kitAvatarImage [src]="photo" alt="" /><span kitAvatarFallback>AB</span></span>

import {
    Component,
    computed,
    Directive,
    inject,
    input,
    signal,
} from "@angular/core";
import { cn } from "#/lib/cn";

/** Base UI's image loading status. */
export type ImageStatus = "idle" | "loading" | "loaded" | "error";

@Directive({
    selector: "[kitAvatar]",
    host: { "data-slot": "avatar", "[class]": "classes()" },
})
export class AvatarRoot {
    readonly class = input<string>();
    /** How the image is doing (`idle` without one). */
    readonly status = signal<ImageStatus>("idle");
    protected readonly classes = computed(() =>
        cn(
            "relative flex size-10 shrink-0 overflow-hidden rounded-full",
            this.class(),
        ),
    );
}

/** The picture: hidden until it has loaded. */
@Directive({
    selector: "img[kitAvatarImage]",
    host: {
        "data-slot": "avatar-image",
        "[attr.data-status]": "root.status()",
        "[style.display]": "root.status() === 'loaded' ? null : 'none'",
        "[class]": "classes()",
        "(load)": "root.status.set('loaded')",
        "(error)": "root.status.set('error')",
    },
})
export class AvatarImage {
    readonly class = input<string>();
    protected readonly root = inject(AvatarRoot);
    protected readonly classes = computed(() =>
        cn(
            "aspect-square size-full object-cover",
            "data-[starting-style]:animate-in data-[starting-style]:fade-in-0",
            this.class(),
        ),
    );

    constructor() {
        this.root.status.set("loading");
    }
}

/** What shows until the image has loaded (or when there is none). */
@Component({
    selector: "[kitAvatarFallback]",
    host: { "data-slot": "avatar-fallback", "[class]": "classes()" },
    template: `@if (root.status() !== "loaded") {<ng-content />}`,
})
export class AvatarFallback {
    readonly class = input<string>();
    protected readonly root = inject(AvatarRoot);
    protected readonly classes = computed(() =>
        cn(
            "absolute inset-0 flex size-full items-center justify-center rounded-full bg-palette-soft text-sm font-medium text-palette-contrast",
            this.class(),
            this.root.status() === "loaded" && "hidden",
        ),
    );
}

/** Every part of an avatar, for a component's `imports`. */
export const AVATAR = [AvatarRoot, AvatarImage, AvatarFallback] as const;
