import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from "@angular/core";
import {
    type DataGridFeature,
    injectDataGrid,
    injectGridView,
} from "@fragiola/data-grid-angular";
import type { RowSelectionTypes } from "@fragiola/data-grid-angular/row-selection";
import type { Task } from "../_kit/tasks";
import { Checkbox } from "./checkbox";

// A row's native checkbox: the grid toggles the row, a Shift+click selects since the last one.

@Component({
    selector: "example-select-row",
    imports: [Checkbox],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <example-checkbox [label]="'Select ' + name()" [checked]="checked()" (toggle)="toggle($event)" />
    `,
})
export class SelectRow {
    readonly rowIndex = input.required<number>();
    readonly name = input.required<string>();

    // the grid's model, typed by the feature this part reads (row selection, installed by the grid)

    private readonly grid = injectDataGrid<
        Task,
        [DataGridFeature<RowSelectionTypes>]
    >();
    // the view moves with the selection: the box follows
    private readonly view = injectGridView();
    protected readonly checked = computed(() => {
        this.view();
        return this.grid.model.is("row-selected", {
            rowIndex: this.rowIndex(),
        });
    });

    protected toggle(extend: boolean) {
        this.grid.model.run("selected-rows.toggle", {
            rowIndex: this.rowIndex(),
            extend,
        });
    }
}
