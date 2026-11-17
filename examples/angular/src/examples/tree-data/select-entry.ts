import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from "@angular/core";
import type { CellInfo, RowKey } from "@fragiola/data-grid-angular";
import { injectSelectAll } from "@fragiola/data-grid-angular/row-selection";
import { CHECKBOX } from "#/components/ui/checkbox";
import type { Entry } from "./files";
import * as styles from "./styles";

// An entry's checkbox: the entry and everything under it (a folder's at every depth, the
// collapsed ones too), all of them, some (indeterminate) or none. The grid selects one row at a
// time; the app adds a folder's entries, here with `injectSelectAll` over their keys.

@Component({
    selector: "example-select-entry",
    imports: [CHECKBOX],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.selectEntry" },
    template: `
        @if (cell().row; as entry) {
            <button
                kitCheckbox
                [attr.aria-label]="'Select ' + entry.name"
                [checked]="all.status === 'all'"
                [indeterminate]="all.status === 'some'"
                (checkedChange)="all.toggle()"
            >
                <span kitCheckboxIndicator></span>
            </button>
        }
    `,
})
export class SelectEntry {
    protected readonly styles = styles;
    readonly cell = input.required<CellInfo<Entry>>();
    readonly subRowKeysOf =
        input.required<(rowIndex: number) => readonly RowKey[]>();

    private readonly keys = computed((): readonly RowKey[] => {
        const id = this.cell().row?.id;
        return id === undefined
            ? []
            : [id, ...this.subRowKeysOf()(this.cell().rowIndex)];
    });
    protected readonly all = injectSelectAll(this.keys);
}
