import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { RowKey } from "@fragiola/data-grid-angular";
import { injectSelectAll } from "@fragiola/data-grid-angular/row-selection";
import { CHECKBOX } from "#/components/ui/checkbox";

// The header's checkbox: every selectable row, some (indeterminate) or none.

@Component({
    selector: "example-select-all",
    imports: [CHECKBOX],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <!-- one row at a time: it only clears -->
        <button
            kitCheckbox
            aria-label="Select all"
            [checked]="all.status === 'all'"
            [indeterminate]="all.status === 'some'"
            [disabled]="!all.canToggle"
            (checkedChange)="all.toggle()"
        >
            <span kitCheckboxIndicator></span>
        </button>
    `,
})
export class SelectAll {
    readonly rowKeys = input.required<readonly RowKey[]>();

    protected readonly all = injectSelectAll(() => this.rowKeys());
}
