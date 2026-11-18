import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { DataGridFeature, RowKey } from "@fragiola/data-grid";
import type {
    RowGroupingProps,
    RowGroupingTypes,
} from "@fragiola/data-grid/row-grouping";
import { DataGridRoot } from "@fragiola/data-grid-angular";

/**
 * The root's expanded row groups (React's `expandedGroupKeys`, `defaultExpandedGroupKeys` and
 * `onExpandedGroupKeysChange` on `Root`, typed by `rowGrouping()`): on the root's element, with
 * `rowGrouping()` in its features (`<div dataGridRoot [features]="features" dataGridRowGrouping
 * [(expandedGroupKeys)]="expanded">`). Its inputs are the root's. Without `rowGrouping()`
 * installed, the core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridRowGrouping]",
    exportAs: "dataGridRowGrouping",
})
export class DataGridRowGrouping {
    /**
     * the expanded row groups' keys (a group row's `GroupRow.key`, a row that expands by its key),
     * controlled; pair it with `expandedGroupKeysChange` (`[(expandedGroupKeys)]`)
     */
    readonly expandedGroupKeys = input<readonly RowKey[] | undefined>(
        undefined,
    );
    /** the expanded row groups' keys to start with, uncontrolled */
    readonly defaultExpandedGroupKeys = input<readonly RowKey[] | undefined>(
        undefined,
    );
    /**
     * the expanded row groups changed (or, controlled, ask to): a group was toggled (its toggle,
     * Enter, Space, → or ←), or a command ran
     */
    readonly expandedGroupKeysChange = output<readonly RowKey[]>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (expandedGroupKeys: readonly RowKey[]) =>
        this.expandedGroupKeysChange.emit(expandedGroupKeys);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<RowGroupingTypes>]>(
                (): RowGroupingProps => ({
                    expandedGroupKeys: this.expandedGroupKeys(),
                    defaultExpandedGroupKeys: this.defaultExpandedGroupKeys(),
                    onExpandedGroupKeysChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}
