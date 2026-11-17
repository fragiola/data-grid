// Angular port of the Fragiola UI switch (examples/react/src/components/ui/switch.tsx): the same
// parts, classes and palette roles. Angular Aria and CDK have no switch: this is the WAI-ARIA
// switch pattern on a native `<button role="switch">` (Space and Enter toggle it, as a button's
// click), with Base UI's `data-checked` state attribute so the classes are the React ones.
// `[(checked)]` is Base UI's `checked`/`onCheckedChange`; unbound, the switch keeps its own state.
//
//     <button kitSwitch [(checked)]="live" aria-label="Live stream"><span kitSwitchThumb></span></button>

import {
    booleanAttribute,
    computed,
    Directive,
    inject,
    input,
    model,
} from "@angular/core";
import { cn } from "#/lib/cn";

@Directive({
    selector: "button[kitSwitch]",
    exportAs: "kitSwitch",
    host: {
        type: "button",
        role: "switch",
        "data-slot": "switch",
        "[attr.aria-checked]": "checked()",
        "[attr.data-checked]": "checked() ? '' : null",
        "[attr.data-unchecked]": "checked() ? null : ''",
        "[attr.data-disabled]": "disabled() ? '' : null",
        "[disabled]": "disabled()",
        "[class]": "classes()",
        "(click)": "toggle()",
    },
})
export class Switch {
    readonly checked = model(false);
    readonly disabled = input(false, { transform: booleanAttribute });
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(
            "field-control inline-flex shrink-0 items-center rounded-full border border-transparent",
            "w-8 h-5 p-0.5",
            "bg-palette-soft data-checked:bg-palette-ring",
            "field-focus:outline-solid field-focus:outline-1 field-focus:outline-offset-1 field-focus:outline-palette-ring",
            "data-disabled:opacity-50 data-disabled:cursor-not-allowed",
            "transition-colors",
            this.class(),
        ),
    );

    toggle() {
        if (!this.disabled()) this.checked.set(!this.checked());
    }
}

@Directive({
    selector: "[kitSwitchThumb]",
    host: {
        "data-slot": "switch-thumb",
        "[attr.data-checked]": "root.checked() ? '' : null",
        "[class]": "classes()",
    },
})
export class SwitchThumb {
    readonly class = input<string>();
    protected readonly root = inject(Switch);
    protected readonly classes = computed(() =>
        cn(
            "block size-4 rounded-full bg-palette-ring transition-transform data-checked:translate-x-3 data-checked:bg-palette-base",
            this.class(),
        ),
    );
}

/** Both parts of a switch, for a component's `imports`. */
export const SWITCH = [Switch, SwitchThumb] as const;
