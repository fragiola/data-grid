import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { RowKey } from "@fragiola/data-grid-angular";
import { injectSelectAll } from "@fragiola/data-grid-angular/selection";
import { Checkbox } from "./checkbox";

// The header's native checkbox: every row, some (indeterminate) or none.

@Component({
    selector: "example-select-all",
    imports: [Checkbox],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <example-checkbox
            label="Select all"
            [checked]="all.status === 'all'"
            [indeterminate]="all.status === 'some'"
            (toggle)="all.toggle()"
        />
    `,
})
export class SelectAll {
    readonly rowKeys = input.required<readonly RowKey[]>();

    protected readonly all = injectSelectAll(() => this.rowKeys());
}
