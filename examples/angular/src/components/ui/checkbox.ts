// Angular port of the Fragiola UI checkbox (examples/react/src/components/ui/checkbox.tsx): the same
// parts, classes and palette roles. Angular Aria has no checkbox and CDK none outside a listbox:
// this is the WAI-ARIA checkbox pattern on a native `<button role="checkbox">`, as Base UI's root
// renders, with Base UI's state attributes (`data-checked`, `data-unchecked`,
// `data-indeterminate`, `data-disabled`) so the classes are the React ones.
//
//     <button kitCheckbox [checked]="selected" [indeterminate]="some" aria-label="Select row"
//         (checkedChange)="toggle($event.checked, $event.event)">
//         <span kitCheckboxIndicator></span>
//     </button>
//
// What differs from the React one, and why:
//   - `checked` and `indeterminate` are inputs, as Base UI takes them; a change is the output
//     `(checkedChange)`, `{ checked, event }` (Base UI's `onCheckedChange(checked, details)`): the
//     event tells a Shift+click (a range) from a click. The box keeps no state of its own: the
//     app gives it back, as every example does.
//   - Space toggles it (a button's click); Enter does not (APG's checkbox, Base UI's), and is
//     prevented, so a grid around never takes it for its own.

import {
    booleanAttribute,
    Component,
    computed,
    Directive,
    inject,
    input,
    output,
} from "@angular/core";
import { LucideCheck } from "@lucide/angular";
import { cn } from "#/lib/cn";

/** A change: the state asked for, and the click (or key) that asked. */
export interface CheckedChange {
    checked: boolean;
    event: Event;
}

@Directive({
    selector: "button[kitCheckbox]",
    exportAs: "kitCheckbox",
    host: {
        type: "button",
        role: "checkbox",
        "data-slot": "checkbox",
        "[attr.aria-checked]": "indeterminate() ? 'mixed' : checked()",
        "[attr.data-checked]": "state() === true ? '' : null",
        "[attr.data-unchecked]": "state() === false ? '' : null",
        "[attr.data-indeterminate]": "state() === 'indeterminate' ? '' : null",
        "[attr.data-disabled]": "disabled() ? '' : null",
        "[disabled]": "disabled()",
        "[class]": "classes()",
        "(click)": "toggle($event)",
        "(keydown.enter)": "$event.preventDefault()",
    },
})
export class Checkbox {
    readonly checked = input(false, { transform: booleanAttribute });
    readonly indeterminate = input(false, { transform: booleanAttribute });
    readonly disabled = input(false, { transform: booleanAttribute });
    readonly class = input<string>();
    /** Asks for the other state (an indeterminate box asks to be checked). */
    readonly checkedChange = output<CheckedChange>();
    /** Base UI's state: checked, unchecked or indeterminate. */
    readonly state = computed<boolean | "indeterminate">(() =>
        this.indeterminate() ? "indeterminate" : this.checked(),
    );
    protected readonly classes = computed(() =>
        cn(
            "field-control size-4 shrink-0 rounded-sm border",
            "border-palette-line bg-palette-soft",
            "data-checked:bg-palette-ring data-checked:border-palette-line data-checked:text-palette-base",
            "field-focus:outline-solid field-focus:outline-1 field-focus:outline-offset-1 field-focus:outline-palette-ring",
            "data-disabled:opacity-50 data-disabled:cursor-not-allowed",
            "transition-colors",
            this.class(),
        ),
    );

    protected toggle(event: Event) {
        if (this.disabled()) return;
        this.checkedChange.emit({
            checked: this.indeterminate() || !this.checked(),
            event,
        });
    }
}

/** The check: rendered while the box is checked or indeterminate, as Base UI's indicator. */
@Component({
    selector: "[kitCheckboxIndicator]",
    imports: [LucideCheck],
    host: {
        "data-slot": "checkbox-indicator",
        "[attr.data-checked]": "box.state() === true ? '' : null",
        "[attr.data-indeterminate]":
            "box.state() === 'indeterminate' ? '' : null",
        "[class]": "classes()",
    },
    template: `@if (box.state() !== false) {<svg lucideCheck class="size-3.5"></svg>}`,
})
export class CheckboxIndicator {
    readonly class = input<string>();
    protected readonly box = inject(Checkbox);
    protected readonly classes = computed(() =>
        cn("grid place-content-center text-current", this.class()),
    );
}

/** Both parts of a checkbox, for a component's `imports`. */
export const CHECKBOX = [Checkbox, CheckboxIndicator] as const;
