import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import {
    type GroupRow,
    injectDataGrid,
    type RowKey,
} from "@fragiola/data-grid-angular";
import { injectSelectAll } from "@fragiola/data-grid-angular/selection";
import { CHECKBOX } from "#/components/ui/checkbox";
import type { Person } from "../_kit/data";

// A group's checkbox: all of its people, some of them (indeterminate) or none.

const NO_KEYS: readonly RowKey[] = [];

@Component({
    selector: "example-select-group",
    imports: [CHECKBOX],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button
            kitCheckbox
            [attr.aria-label]="'Select ' + label()"
            [checked]="all.status === 'all'"
            [indeterminate]="all.status === 'some'"
            (checkedChange)="toggle()"
        >
            <span kitCheckboxIndicator></span>
        </button>
    `,
})
export class SelectGroup {
    readonly rowIndex = input.required<number>();
    readonly group = input.required<GroupRow>();

    private readonly grid = injectDataGrid<Person>();
    protected readonly all = injectSelectAll(
        () => this.group().rowKeys ?? NO_KEYS,
    );

    protected label() {
        return String(this.group().value);
    }

    // the grid selects the group's rows, or clears them all
    protected toggle() {
        this.grid.model.run("selected-rows.toggle", {
            rowIndex: this.rowIndex(),
        });
    }
}
