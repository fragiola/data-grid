import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { RowKey } from "@fragiola/data-grid-angular";
import { injectSelectAll } from "@fragiola/data-grid-angular/selection";
import { CHECKBOX } from "#/components/ui/checkbox";
import * as styles from "./styles";

// The header's checkbox: every selectable job, some (indeterminate) or none.

@Component({
    selector: "example-select-all",
    imports: [CHECKBOX],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.control" },
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
export class SelectAll {
    protected readonly styles = styles;
    /** the rows it covers: the ones that can be selected */
    readonly rowKeys = input.required<readonly RowKey[]>();

    protected readonly all = injectSelectAll(() => this.rowKeys());
}
