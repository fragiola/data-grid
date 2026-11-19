import {
    computed,
    Directive,
    forwardRef,
    inject,
    input,
    type Signal,
} from "@angular/core";
import {
    type HeaderRowState,
    headerRowPartOf,
    LAYER_KEYS,
} from "@fragiola/data-grid";
import {
    DATA_GRID_HEADER_ROW,
    type HeaderRowInfo,
    injectGrid,
} from "../context";
import { bindPart, injectHost } from "../utils/helpers";

/**
 * A header row (`role="row"`), one of the layers the engine moves with the columns:
 * `<div [dataGridHeaderRow]="row">`, or a `<tr>`. Without a row, the one `[dataGridHeaderRows]`
 * renders, else the columns' row (with column groups, render the rows through
 * `[dataGridHeaderRows]`). Its cells: `<ng-template dataGridHeaderCells let-cell>`.
 */
@Directive({
    selector: "[dataGridHeaderRow]",
    exportAs: "dataGridHeaderRow",
    providers: [
        {
            provide: DATA_GRID_HEADER_ROW,
            useExisting: forwardRef(() => DataGridHeaderRow),
        },
    ],
})
// It provides `DATA_GRID_HEADER_ROW` as a `HeaderRowContext`, but does not declare `implements HeaderRowContext`: the members
// that make it one are `@internal`, stripped from the published declarations, which would then
// declare a class missing them (an error for an app that type-checks its libraries).
// tests/contexts.test.ts checks it is one.
export class DataGridHeaderRow<TRow = unknown> {
    /** its header row; without it, the columns' row */
    readonly dataGridHeaderRow = input<HeaderRowInfo<TRow> | "" | undefined>(
        undefined,
    );

    private readonly grid = injectGrid("[dataGridHeaderRow]");
    private readonly around = inject(DATA_GRID_HEADER_ROW, {
        optional: true,
        skipSelf: true,
    });

    /** @internal the header row: the given one, else the one around, else the last */
    readonly headerRow: Signal<HeaderRowInfo | undefined> = computed(() => {
        const given = this.dataGridHeaderRow();
        if (given) return given as HeaderRowInfo;
        const { headerRows } = this.grid.view();
        return this.around?.headerRow() ?? headerRows[headerRows.length - 1];
    });

    private readonly part = computed(() =>
        headerRowPartOf(this.grid.view(), this.headerRow()?.rowIndex ?? -1),
    );

    /** the header row's state */
    readonly state: Signal<HeaderRowState> = computed(() => this.part().state);

    constructor() {
        bindPart(
            () => this.grid.engine,
            injectHost(),
            () => ({
                props: this.part().props,
                layer: "header",
                drop: LAYER_KEYS,
            }),
        );
    }
}
