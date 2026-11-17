import {
    computed,
    Directive,
    forwardRef,
    input,
    type Signal,
} from "@angular/core";
import {
    type HeaderCellState,
    headerCellContent,
    headerCellPartOf,
} from "@fragiola/data-grid";
import {
    type CellContext,
    type CellInfo,
    DATA_GRID_CELL,
    type HeaderCellInfo,
    injectGrid,
} from "../context";
import { cellBinding } from "../utils/cell-binding";
import type { DataGridNode } from "../utils/content";
import { bindPart, injectHost } from "../utils/helpers";

/**
 * A header cell (`role="columnheader"`), a group's or a column's: `<div [dataGridHeaderCell]="cell">`,
 * or a `<th>`, which then gets `colspan`/`rowspan` too. Its content is the app's:
 * `<ng-container *dataGridCellContent />` renders the default one (`renderHeaderCell`, else the
 * `name`).
 */
@Directive({
    selector: "[dataGridHeaderCell]",
    exportAs: "dataGridHeaderCell",
    providers: [
        {
            provide: DATA_GRID_CELL,
            useExisting: forwardRef(() => DataGridHeaderCell),
        },
    ],
})
export class DataGridHeaderCell<TRow = unknown> implements CellContext {
    /** the header cell, as `[dataGridHeaderCells]` hands it */
    readonly dataGridHeaderCell = input.required<HeaderCellInfo<TRow>>();

    private readonly grid = injectGrid("[dataGridHeaderCell]");
    private readonly host = injectHost();
    private readonly part = computed(() =>
        headerCellPartOf(
            this.grid.view(),
            this.dataGridHeaderCell() as HeaderCellInfo,
        ),
    );

    /** the header cell's state: its sort, its resize, its drag, its group's collapse */
    readonly state: Signal<HeaderCellState> = computed(() => this.part().state);

    /** @internal */
    readonly content: Signal<DataGridNode> = computed(
        () => headerCellContent(this.dataGridHeaderCell()) ?? null,
    );

    /** @internal */
    readonly bodyCell: Signal<CellInfo | null> = computed(() => null);

    constructor() {
        bindPart(
            () => this.grid.engine,
            this.host,
            () => {
                const cell = this.dataGridHeaderCell();
                return cellBinding(
                    this.host,
                    this.part(),
                    cell.columnSpan,
                    false,
                    cell.rowSpan,
                );
            },
        );
    }
}
