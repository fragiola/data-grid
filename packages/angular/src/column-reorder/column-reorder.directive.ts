import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { ColumnOrder, DataGridFeature } from "@fragiola/data-grid";
import type {
    ColumnReorderProps,
    ColumnReorderTypes,
} from "@fragiola/data-grid/column-reorder";
import { DataGridRoot } from "@fragiola/data-grid-angular";

/**
 * The root's column order (React's `columnOrder`, `defaultColumnOrder` and `onColumnOrderChange`
 * on `Root`, typed by `columnReorder()`): on the root's element, with `columnReorder()` in its
 * features (`<div dataGridRoot [features]="features" dataGridColumnReorder
 * [(columnOrder)]="order">`). Its inputs are the root's. Without `columnReorder()` installed, the
 * core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridColumnReorder]",
    exportAs: "dataGridColumnReorder",
})
export class DataGridColumnReorder {
    /**
     * the order columns and groups take among their siblings, by key, controlled; pair it with
     * `columnOrderChange` (`[(columnOrder)]`). The ones not listed keep their place
     */
    readonly columnOrder = input<ColumnOrder | undefined>(undefined);
    /** the column order to start with, uncontrolled */
    readonly defaultColumnOrder = input<ColumnOrder | undefined>(undefined);
    /**
     * the order changed (or, controlled, asks to): a header cell was dropped or moved with the
     * keys, or a command ran
     */
    readonly columnOrderChange = output<ColumnOrder>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (columnOrder: ColumnOrder) =>
        this.columnOrderChange.emit(columnOrder);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<ColumnReorderTypes>]>(
                (): ColumnReorderProps => ({
                    columnOrder: this.columnOrder(),
                    defaultColumnOrder: this.defaultColumnOrder(),
                    onColumnOrderChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}
