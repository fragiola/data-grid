import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from "@angular/core";
import { CHECKBOX } from "#/components/ui/checkbox";

// The header's checkbox: every row of the server's, some (indeterminate) or none. How many are
// selected is the example's (its input); a click asks it to select every row or none.

@Component({
    selector: "example-select-all",
    imports: [CHECKBOX],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button
            kitCheckbox
            aria-label="Select all"
            [checked]="count() === total()"
            [indeterminate]="count() > 0 && count() < total()"
            (checkedChange)="toggle.emit($event.checked)"
        >
            <span kitCheckboxIndicator></span>
        </button>
    `,
})
export class SelectAll {
    readonly count = input.required<number>();
    readonly total = input.required<number>();
    readonly toggle = output<boolean>();
}
