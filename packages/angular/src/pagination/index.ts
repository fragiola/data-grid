// @fragiola/data-grid-angular/pagination: the pagination feature (Epic #153), for an app that
// installs only this package: the core's (`@fragiola/data-grid/pagination`), and the root's page
// inputs. An opt-in entry point: the directives never import it, and an app that never installs
// pagination never ships it.

import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { DataGridFeature } from "@fragiola/data-grid";
import type {
    PaginationProps,
    PaginationTypes,
} from "@fragiola/data-grid/pagination";
import { DataGridRoot } from "@fragiola/data-grid-angular";

export {
    type PageInfo,
    type PaginationProps,
    type PaginationState,
    type PaginationTypes,
    pageCount,
    pagination,
} from "@fragiola/data-grid/pagination";

/**
 * The root's page (React's `pageIndex`, `pageSize`, their defaults and handlers, and
 * `totalRowCount` on `Root`, typed by `pagination()`): on the root's element, with `pagination()`
 * in its features (`<div dataGridRoot [features]="features" dataGridPagination
 * [(pageIndex)]="page" [pageSize]="50" [totalRowCount]="total">`). Its inputs are the root's:
 * `[dataGridLocalRows]` wins over them. Without `pagination()` installed, the core reads none of
 * them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridPagination]",
    exportAs: "dataGridPagination",
})
export class DataGridPagination {
    /** the current page, from 0, controlled; pair it with `pageIndexChange` (`[(pageIndex)]`) */
    readonly pageIndex = input<number | undefined>(undefined);
    /** the page to start on, uncontrolled */
    readonly defaultPageIndex = input<number | undefined>(undefined);
    /** the page changed (or, controlled, asks to): a command ran */
    readonly pageIndexChange = output<number>();
    /** rows per page, controlled (`null`: none, a single page); pair it with `pageSizeChange` */
    readonly pageSize = input<number | null | undefined>(undefined);
    /** rows per page to start with, uncontrolled */
    readonly defaultPageSize = input<number | undefined>(undefined);
    /** the page size changed (or, controlled, asks to): a command ran (`undefined`: none) */
    readonly pageSizeChange = output<number | undefined>();
    /** the rows across every page, for the page count (a server's total); followed */
    readonly totalRowCount = input<number | undefined>(undefined);

    /** one handler each for the directive's life: the root renders what the app did with it */
    private readonly indexChanged = (pageIndex: number) =>
        this.pageIndexChange.emit(pageIndex);
    private readonly sizeChanged = (pageSize: number | undefined) =>
        this.pageSizeChange.emit(pageSize);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<PaginationTypes>]>(
                (): PaginationProps => ({
                    pageIndex: this.pageIndex(),
                    defaultPageIndex: this.defaultPageIndex(),
                    onPageIndexChange: this.indexChanged,
                    pageSize: this.pageSize(),
                    defaultPageSize: this.defaultPageSize(),
                    onPageSizeChange: this.sizeChanged,
                    totalRowCount: this.totalRowCount(),
                }),
                { inputs: true },
            ),
        );
    }
}
