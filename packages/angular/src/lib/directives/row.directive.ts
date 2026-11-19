import {
    computed,
    Directive,
    forwardRef,
    input,
    type Signal,
} from "@angular/core";
import { type RowState, rowPartOf } from "@fragiola/data-grid";
import { DATA_GRID_ROW, injectGrid, type RowInfo } from "../context";
import { beforeInputs, bindPart, injectHost } from "../utils/helpers";

/**
 * A body row (`role="row"`), positioned in the body layer: `<div [dataGridRow]="row">`, or a
 * `<tr>`. `data-loading` while its row is not loaded, `data-active` while it holds the active
 * cell. Its cells: `<ng-template dataGridCells let-cell>`. A measured row
 * (`rowHeight: "auto"`) is read by the engine.
 */
@Directive({
    selector: "[dataGridRow]",
    exportAs: "dataGridRow",
    providers: [
        { provide: DATA_GRID_ROW, useExisting: forwardRef(() => DataGridRow) },
    ],
})
// It provides `DATA_GRID_ROW` as a `RowContext`, but does not declare `implements RowContext`: the members
// that make it one are `@internal`, stripped from the published declarations, which would then
// declare a class missing them (an error for an app that type-checks its libraries).
// tests/contexts.test.ts checks it is one.
export class DataGridRow<TRow = unknown> {
    /** the row, as `[dataGridRows]` hands it */
    readonly dataGridRow = input.required<RowInfo<TRow>>();

    private readonly grid = injectGrid("[dataGridRow]");
    private readonly part = computed(() =>
        rowPartOf(this.grid.view(), this.dataGridRow()),
    );

    /** @internal */
    readonly rowInfo: Signal<RowInfo> = this.dataGridRow;

    /** the row's state (`#row="dataGridRow"`, then `row.state().active`) (`undefined` on the first pass of a binding on its own element, before its input is set) */
    readonly state: Signal<RowState | undefined> = computed(() =>
        beforeInputs(undefined, () => this.part().state),
    );

    constructor() {
        bindPart(
            () => this.grid.engine,
            injectHost(),
            () => {
                const { props, measured } = this.part();
                return { props, layer: measured ? "row" : null };
            },
        );
    }
}
