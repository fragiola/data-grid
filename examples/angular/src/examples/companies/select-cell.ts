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
import { CHECKBOX, type CheckedChange } from "#/components/ui/checkbox";

// A row's checkbox: the grid toggles it, a Shift+click selects the rows since the last one.

@Component({
    selector: "example-select-cell",
    imports: [CHECKBOX],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
        <button
            kitCheckbox
            [attr.aria-label]="'Select ' + name()"
            [checked]="checked()"
            (checkedChange)="toggle($event)"
        >
            <span kitCheckboxIndicator></span>
        </button>
    `,
})
export class SelectCell {
    readonly rowIndex = input.required<number>();
    readonly name = input.required<string>();

    // the grid's model, typed by the feature this part reads (row selection, installed by the grid)

    private readonly grid = injectDataGrid<
        unknown,
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

    protected toggle({ event }: CheckedChange) {
        this.grid.model.run("selected-rows.toggle", {
            rowIndex: this.rowIndex(),
            extend: event instanceof MouseEvent && event.shiftKey,
        });
    }
}
