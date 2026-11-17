import {
    computed,
    Directive,
    forwardRef,
    input,
    type Signal,
} from "@angular/core";
import {
    type CellState,
    cellContent,
    cellPartOf,
    editActions,
    editCellPropsOf,
} from "@fragiola/data-grid";
import {
    type CellContext,
    type CellInfo,
    DATA_GRID_CELL,
    injectGrid,
} from "../context";
import { cellBinding } from "../utils/cell-binding";
import type { DataGridNode } from "../utils/content";
import { bindPart, injectHost } from "../utils/helpers";

/**
 * A body cell (`role="gridcell"`), positioned in its row: `<div [dataGridCell]="cell">`, or a
 * `<td>`, which then gets `colspan` when it spans columns. The active cell is the grid's tab stop
 * (`tabindex` 0, `data-active`); the others take focus on click. Its content is the app's:
 * `<ng-container *dataGridCellContent />` renders the default one (its column's `renderCell`, its
 * value as text, or, edited, its column's `renderEditCell`).
 */
@Directive({
    selector: "[dataGridCell]",
    exportAs: "dataGridCell",
    providers: [
        {
            provide: DATA_GRID_CELL,
            useExisting: forwardRef(() => DataGridCell),
        },
    ],
})
export class DataGridCell<TRow = unknown> implements CellContext {
    /** the cell, as `[dataGridCells]` hands it */
    readonly dataGridCell = input.required<CellInfo<TRow>>();

    private readonly grid = injectGrid("[dataGridCell]");
    private readonly host = injectHost();
    private readonly part = computed(() =>
        cellPartOf(this.grid.view(), this.dataGridCell() as CellInfo),
    );

    /** the cell's state (`#cell="dataGridCell"`, then `cell.state().active`) */
    readonly state: Signal<CellState> = computed(() => this.part().state);

    /** @internal */
    readonly bodyCell: Signal<CellInfo | null> = computed(
        () => this.dataGridCell() as CellInfo,
    );

    /** @internal the default content: edited, its column's editor, given the draft */
    readonly content: Signal<DataGridNode> = computed(() => {
        const cell = this.dataGridCell() as CellInfo;
        const { column } = cell;
        if (this.state().editing && column.renderEditCell) {
            const props = editCellPropsOf(
                this.grid.view(),
                cell,
                this.grid.draft(),
                editActions(this.grid.engine),
            );
            return props ? column.renderEditCell(props) : null;
        }
        // a group row's renderer or value, a loaded row's (the core's rule)
        return cellContent(cell);
    });

    constructor() {
        bindPart(
            () => this.grid.engine,
            this.host,
            () => {
                const own = this.part();
                return cellBinding(
                    this.host,
                    own,
                    own.columnSpan,
                    own.measured,
                );
            },
        );
    }
}
