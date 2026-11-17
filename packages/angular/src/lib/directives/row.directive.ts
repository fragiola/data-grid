import {
    computed,
    Directive,
    forwardRef,
    input,
    type Signal,
} from "@angular/core";
import { type RowState, rowPartOf } from "@fragiola/data-grid";
import {
    DATA_GRID_ROW,
    injectGrid,
    type RowContext,
    type RowInfo,
} from "../context";
import { bindPart, injectHost } from "../utils/helpers";

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
export class DataGridRow<TRow = unknown> implements RowContext {
    /** the row, as `[dataGridRows]` hands it */
    readonly dataGridRow = input.required<RowInfo<TRow>>();

    private readonly grid = injectGrid("[dataGridRow]");
    private readonly part = computed(() =>
        rowPartOf(this.grid.view(), this.dataGridRow()),
    );

    /** @internal */
    readonly rowInfo: Signal<RowInfo> = this.dataGridRow;

    /** the row's state (`#row="dataGridRow"`, then `row.state().active`) */
    readonly state: Signal<RowState> = computed(() => this.part().state);

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
