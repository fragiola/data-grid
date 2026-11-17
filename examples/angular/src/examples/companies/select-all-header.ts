import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { RowKey } from "@fragiola/data-grid-angular";
import { injectSelectAll } from "@fragiola/data-grid-angular/row-selection";
import { CHECKBOX } from "#/components/ui/checkbox";

// The header's checkbox over every company: every row, some (indeterminate) or none. The ids of
// the companies the grid holds (what it selects) are its input, given by the example's template,
// so the columns stay the same.

@Component({
    selector: "example-select-all-header",
    imports: [CHECKBOX],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button
            kitCheckbox
            aria-label="Select all"
            [checked]="all.status === 'all'"
            [indeterminate]="all.status === 'some'"
            (checkedChange)="all.toggle()"
        >
            <span kitCheckboxIndicator></span>
        </button>
    `,
})
export class SelectAllHeader {
    readonly rowKeys = input.required<readonly RowKey[]>();
    protected readonly all = injectSelectAll(this.rowKeys);
}
