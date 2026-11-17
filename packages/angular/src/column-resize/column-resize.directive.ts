import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { ColumnWidths, DataGridFeature } from "@fragiola/data-grid";
import type {
    ColumnResizeProps,
    ColumnResizeTypes,
} from "@fragiola/data-grid/column-resize";
import { DataGridRoot } from "@fragiola/data-grid-angular";

/**
 * The root's column widths (React's `columnWidths`, `defaultColumnWidths` and
 * `onColumnWidthsChange` on `Root`, typed by `columnResize()`): on the root's element, with
 * `columnResize()` in its features (`<div dataGridRoot [features]="features" dataGridColumnResize
 * [(columnWidths)]="widths">`). Its inputs are the root's. Without `columnResize()` installed, the
 * core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridColumnResize]",
    exportAs: "dataGridColumnResize",
})
export class DataGridColumnResize {
    /**
     * the resized columns' widths in pixels, by column key, controlled; pair it with
     * `columnWidthsChange` (`[(columnWidths)]`)
     */
    readonly columnWidths = input<ColumnWidths | undefined>(undefined);
    /** the resized columns' widths to start with, uncontrolled */
    readonly defaultColumnWidths = input<ColumnWidths | undefined>(undefined);
    /**
     * the widths changed (or, controlled, ask to): a resizer was dragged (once per frame), moved
     * with the keys, fitted, or a command ran
     */
    readonly columnWidthsChange = output<ColumnWidths>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (columnWidths: ColumnWidths) =>
        this.columnWidthsChange.emit(columnWidths);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<ColumnResizeTypes>]>(
                (): ColumnResizeProps => ({
                    columnWidths: this.columnWidths(),
                    defaultColumnWidths: this.defaultColumnWidths(),
                    onColumnWidthsChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}
