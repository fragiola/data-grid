import type { FeatureTypes } from "../feature/feature";

/** What pagination keeps in the model's state. */
export interface PaginationState {
    /** the current page, from 0, as set (a page past the last is the app's to clamp) */
    readonly pageIndex: number;
    /** rows per page; `undefined`: a single page of every row */
    readonly pageSize: number | undefined;
    /**
     * the rows across every page (a server's total, `/local`'s rows the filters leave); `undefined`:
     * the grid's own row count
     */
    readonly totalRowCount: number | undefined;
}

/** A page as `get("page-info")` gives it: where it is, its size and how many pages there are. */
export interface PageInfo {
    readonly pageIndex: number;
    readonly pageSize: number | undefined;
    /** how many pages the rows make (1 at least; 1 without a page size) */
    readonly pageCount: number;
    /** the rows across every page: `totalRowCount`, else the grid's own row count */
    readonly rowCount: number;
}

/** What pagination adds to a root's props: the page and its size, controlled or not, and the total. */
export interface PaginationProps {
    /** the current page, from 0, controlled; pair it with `onPageIndexChange` */
    pageIndex?: number | undefined;
    /** the page to start on, uncontrolled */
    defaultPageIndex?: number | undefined;
    /** the page changed (or, controlled, asks to): a command ran */
    onPageIndexChange?: ((pageIndex: number) => void) | undefined;
    /**
     * rows per page, controlled; pair it with `onPageSizeChange`. `null` controls it as "no page
     * size" (a single page)
     */
    pageSize?: number | null | undefined;
    /** rows per page to start with, uncontrolled */
    defaultPageSize?: number | undefined;
    /** the page size changed (or, controlled, asks to): a command ran (`undefined`: none) */
    onPageSizeChange?: ((pageSize: number | undefined) => void) | undefined;
    /**
     * the rows across every page, for the page count (a server's total; `/local` gives the rows
     * its filters leave). Followed; without it, the grid's own row count
     */
    totalRowCount?: number | undefined;
}

/** Pagination's types (Epic #153). */
export interface PaginationTypes extends FeatureTypes {
    readonly state: PaginationState;
    readonly options: {
        readonly pageIndex?: number | undefined;
        readonly pageSize?: number | undefined;
        readonly totalRowCount?: number | undefined;
    };
    readonly commands: {
        /** goes to a page, from 0 (a whole number, 0 or more). Returns it */
        "page.set": {
            payload: { readonly pageIndex: number };
            result: number;
        };
        /** sets rows per page (`undefined`: a single page; else a whole number above 0). Returns it */
        "page-size.set": {
            payload: { readonly pageSize: number | undefined };
            result: number | undefined;
        };
        /** sets the rows across every page (`undefined`: the grid's own row count). Returns it */
        "total-row-count.set": {
            payload: { readonly totalRowCount: number | undefined };
            result: number | undefined;
        };
    };
    readonly queries: {
        /** the page: its index, its size, the page count and the rows they are counted from */
        "page-info": { payload: undefined; result: PageInfo };
        /** how many pages the rows make (1 at least) */
        "page-count": { payload: undefined; result: number };
    };
    readonly questions: {
        /** whether there is a page before the current one */
        "page-previous": undefined;
        /** whether there is a page after the current one */
        "page-next": undefined;
    };
    readonly props: PaginationProps;
}
