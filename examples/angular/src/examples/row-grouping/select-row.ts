import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from "@angular/core";
import { injectDataGrid, injectGridView } from "@fragiola/data-grid-angular";
import { CHECKBOX } from "#/components/ui/checkbox";
import type { Person } from "../_kit/data";

// A person's checkbox: the grid toggles the row.

@Component({
    selector: "example-select-row",
    imports: [CHECKBOX],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button
            kitCheckbox
            [attr.aria-label]="'Select ' + name()"
            [checked]="checked()"
            [disabled]="!selectable()"
            (checkedChange)="toggle()"
        >
            <span kitCheckboxIndicator></span>
        </button>
    `,
})
export class SelectRow {
    readonly rowIndex = input.required<number>();
    readonly name = input.required<string>();

    private readonly grid = injectDataGrid<Person>();
    // the view moves with the selection: the box follows
    private readonly view = injectGridView();
    protected readonly checked = computed(() => {
        this.view();
        return this.grid.model.is("row-selected", {
            rowIndex: this.rowIndex(),
        });
    });
    protected readonly selectable = computed(() => {
        this.view();
        return this.grid.model.is("row-selectable", {
            rowIndex: this.rowIndex(),
        });
    });

    protected toggle() {
        this.grid.model.run("selected-rows.toggle", {
            rowIndex: this.rowIndex(),
        });
    }
}
