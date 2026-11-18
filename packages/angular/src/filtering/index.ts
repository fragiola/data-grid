// @fragiola/data-grid-angular/filtering: the filtering feature (Epic #153), for an app that
// installs only this package: the core's (`@fragiola/data-grid/filtering`), and the root's filter
// inputs. An opt-in entry point: the directives never import it, and an app that never installs
// filtering never ships it.

import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { DataGridFeature } from "@fragiola/data-grid";
import type {
    ColumnFilters,
    FilteringProps,
    FilteringTypes,
} from "@fragiola/data-grid/filtering";
import { DataGridRoot } from "@fragiola/data-grid-angular";

export {
    type ColumnFilters,
    columnFiltersOf,
    type FilteringProps,
    type FilteringState,
    type FilteringTypes,
    filterableColumn,
    filtering,
    sameFilters,
    validColumnFilters,
} from "@fragiola/data-grid/filtering";

/**
 * The root's column filters (React's `columnFilters`, `defaultColumnFilters` and
 * `onColumnFiltersChange` on `Root`, typed by `filtering()`): on the root's element, with
 * `filtering()` in its features (`<div dataGridRoot [features]="features" dataGridFiltering
 * [(columnFilters)]="filters">`). Its inputs are the root's: `[dataGridLocalRows]` wins over them.
 * Without `filtering()` installed, the core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridFiltering]",
    exportAs: "dataGridFiltering",
})
export class DataGridFiltering {
    /**
     * the column filters, controlled, by column key; pair it with `columnFiltersChange`
     * (`[(columnFilters)]`). The grid keeps them: the app filters the rows it passes
     */
    readonly columnFilters = input<ColumnFilters | undefined>(undefined);
    /** the column filters to start with, uncontrolled */
    readonly defaultColumnFilters = input<ColumnFilters | undefined>(undefined);
    /** the filters changed (or, controlled, ask to): a command ran */
    readonly columnFiltersChange = output<ColumnFilters>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (columnFilters: ColumnFilters) =>
        this.columnFiltersChange.emit(columnFilters);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<FilteringTypes>]>(
                (): FilteringProps => ({
                    columnFilters: this.columnFilters(),
                    defaultColumnFilters: this.defaultColumnFilters(),
                    onColumnFiltersChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}
