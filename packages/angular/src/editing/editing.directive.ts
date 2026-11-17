import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { DataGridFeature, EditingCell } from "@fragiola/data-grid";
import type {
    CellEditEvent,
    EditingProps,
    EditingTypes,
} from "@fragiola/data-grid/editing";
import { DataGridRoot, type TypedBy } from "@fragiola/data-grid-angular";

/**
 * The root's edit (React's `editingCell`, `defaultEditingCell`, `onEditingCellChange` and
 * `onCellEdit` on `Root`, typed by `editing()`): on the root's element, with `navigation()` and
 * `editing()` in its features (`<div dataGridRoot [features]="features" dataGridEditing
 * [(editingCell)]="editing" (cellEdit)="edited($event)">`). Its inputs and outputs are the
 * root's; `cellEdit`'s row is typed by the columns or the root it is given
 * (`[dataGridEditing]="columns"`, else any row). Without `editing()` installed, the core reads
 * none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridEditing]",
    exportAs: "dataGridEditing",
})
export class DataGridEditing<TRow = unknown> {
    /** what types `cellEdit`'s row: the columns, or the root (`#grid="dataGridRoot"`) */
    readonly dataGridEditing = input<TypedBy<TRow>>(undefined);
    /**
     * the cell being edited: the active one, of a column `editable` for its row; controlled
     * (`null` for none), paired with `editingCellChange`
     */
    readonly editingCell = input<EditingCell | null | undefined>(undefined);
    /** the cell being edited to start with, uncontrolled */
    readonly defaultEditingCell = input<EditingCell | null | undefined>(
        undefined,
    );
    /** an edit started or ended (or, controlled, asks to) */
    readonly editingCellChange = output<EditingCell | null>();
    /** an edit committed: the cell, its value and its row. The app writes it */
    readonly cellEdit = output<CellEditEvent<TRow>>();

    /** one handler each for the directive's life: the root renders what the app did with them */
    private readonly changed = (cell: EditingCell | null) =>
        this.editingCellChange.emit(cell);
    private readonly edited = (edit: CellEditEvent<TRow>) =>
        this.cellEdit.emit(edit);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<EditingTypes>]>(
                (): EditingProps<unknown> => ({
                    editingCell: this.editingCell(),
                    defaultEditingCell: this.defaultEditingCell(),
                    onEditingCellChange: this.changed,
                    onCellEdit: this.edited as (
                        edit: CellEditEvent<unknown>,
                    ) => void,
                }),
                { inputs: true },
            ),
        );
    }
}
