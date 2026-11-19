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
    type CellInfo,
    DATA_GRID_CELL,
    type HeaderCellInfo,
    injectGrid,
} from "../context";
import { cellBinding } from "../utils/cell-binding";
import type { DataGridNode } from "../utils/content";
import { beforeInputs, bindPart, injectHost } from "../utils/helpers";

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
// It provides `DATA_GRID_CELL` as a `CellContext`, but does not declare `implements CellContext`: the members
// that make it one are `@internal`, stripped from the published declarations, which would then
// declare a class missing them (an error for an app that type-checks its libraries).
// tests/contexts.test.ts checks it is one.
export class DataGridHeaderCell<TRow = unknown> {
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

    /** the header cell's state: its sort, its resize, its drag, its group's collapse (`undefined` on the first pass of a binding on its own element, before its input is set) */
    readonly state: Signal<HeaderCellState | undefined> = computed(() =>
        beforeInputs(undefined, () => this.part().state),
    );

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
