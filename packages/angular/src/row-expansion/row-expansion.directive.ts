import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type {
    DataGridFeature,
    DetailHeight,
    RowKey,
} from "@fragiola/data-grid";
import type {
    RowExpansionProps,
    RowExpansionTypes,
} from "@fragiola/data-grid/row-expansion";
import { DataGridRoot } from "@fragiola/data-grid-angular";

/**
 * The root's expanded rows and their details' heights (React's `expandedRowKeys`,
 * `defaultExpandedRowKeys`, `onExpandedRowKeysChange`, `detailHeight` and `estimatedDetailHeight`
 * on `Root`, typed by `rowExpansion()`): on the root's element, with `rowExpansion()` in its
 * features (`<div dataGridRoot [features]="features" dataGridRowExpansion
 * [(expandedRowKeys)]="expanded">`). Its inputs are the root's. Without `rowExpansion()`
 * installed, the core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridRowExpansion]",
    exportAs: "dataGridRowExpansion",
})
export class DataGridRowExpansion<TRow = unknown> {
    /**
     * the expanded rows' keys (a row's `rowKey`, else its index), controlled; pair it with
     * `expandedRowKeysChange` (`[(expandedRowKeys)]`). An expanded row shows its
     * `*dataGridRowDetail`
     */
    readonly expandedRowKeys = input<readonly RowKey[] | undefined>(undefined);
    /** the expanded rows' keys to start with, uncontrolled */
    readonly defaultExpandedRowKeys = input<readonly RowKey[] | undefined>(
        undefined,
    );
    /**
     * an expanded row's detail height in pixels, or a function of the row (default 300); `"auto"`:
     * as tall as its content, measured once rendered
     */
    readonly detailHeight = input<DetailHeight<TRow> | undefined>(undefined);
    /** a measured detail's height until it is measured, in pixels (default 300) */
    readonly estimatedDetailHeight = input<number | undefined>(undefined);
    /** the expanded rows changed (or, controlled, ask to): a row was toggled, or a command ran */
    readonly expandedRowKeysChange = output<readonly RowKey[]>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (expandedRowKeys: readonly RowKey[]) =>
        this.expandedRowKeysChange.emit(expandedRowKeys);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<RowExpansionTypes>]>(
                (): RowExpansionProps<unknown> => ({
                    expandedRowKeys: this.expandedRowKeys(),
                    defaultExpandedRowKeys: this.defaultExpandedRowKeys(),
                    onExpandedRowKeysChange: this.changed,
                    detailHeight: this.detailHeight() as
                        | DetailHeight<unknown>
                        | undefined,
                    estimatedDetailHeight: this.estimatedDetailHeight(),
                }),
                { inputs: true },
            ),
        );
    }
}
