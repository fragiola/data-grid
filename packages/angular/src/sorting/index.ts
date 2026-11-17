// @fragiola/data-grid-angular/sorting: the sorting feature (Epic #141), for an app that installs
// only this package: the core's (`@fragiola/data-grid/sorting`), and the root's sort inputs. An
// opt-in entry point: the directives never import it, and an app that never installs sorting
// never ships it.

import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { DataGridFeature } from "@fragiola/data-grid";
import type {
    SortColumn,
    SortingProps,
    SortingTypes,
} from "@fragiola/data-grid/sorting";
import { DataGridRoot } from "@fragiola/data-grid-angular";

export {
    type HeaderCellSort,
    headerCellSort,
    type SortColumn,
    type SortDirection,
    type SortingProps,
    type SortingState,
    type SortingTypes,
    sameSortColumns,
    sortColumnsOf,
    sorting,
    validSortColumns,
} from "@fragiola/data-grid/sorting";

/**
 * The root's sort (React's `sortColumns`, `defaultSortColumns` and `onSortColumnsChange` on
 * `Root`, typed by `sorting()`): on the root's element, with `sorting()` in its features
 * (`<div dataGridRoot [features]="features" dataGridSorting [(sortColumns)]="sort">`). Its inputs
 * are the root's: `[dataGridLocalRows]` wins over them. Without `sorting()` installed, the core
 * reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridSorting]",
    exportAs: "dataGridSorting",
})
export class DataGridSorting {
    /**
     * the sorted columns, controlled, the first one first; pair it with `sortColumnsChange`
     * (`[(sortColumns)]`). The grid keeps the sort: the app orders the rows it passes
     */
    readonly sortColumns = input<readonly SortColumn[] | undefined>(undefined);
    /** the sorted columns to start with, uncontrolled */
    readonly defaultSortColumns = input<readonly SortColumn[] | undefined>(
        undefined,
    );
    /** the sort changed (or, controlled, asks to): a header cell was toggled, or a command ran */
    readonly sortColumnsChange = output<readonly SortColumn[]>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (sortColumns: readonly SortColumn[]) =>
        this.sortColumnsChange.emit(sortColumns);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<SortingTypes>]>(
                (): SortingProps => ({
                    sortColumns: this.sortColumns(),
                    defaultSortColumns: this.defaultSortColumns(),
                    onSortColumnsChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}
