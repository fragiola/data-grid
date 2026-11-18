import type { RowMove, RowReorder } from "../engine/types";
import type { FeatureTypes } from "../feature/feature";

/** The view's fields row reorder adds (`view as GridView & RowReorderView`). */
export interface RowReorderView {
    /** the rows move by their drag handles and the keys (`reorderableRows`, E2.3) */
    readonly reorderableRows: boolean;
    /** the row a drag is moving, and where it would land (E2.3), or `null` */
    readonly rowReorder: RowReorder | null;
}

/** What row reorder adds to a root's props: the move of a row, which the app applies. */
export interface RowReorderProps {
    /**
     * a row was moved (Epic #86): dropped elsewhere by its drag handle (`useRowDragHandle`, from
     * the adapters' `/row-reorder`), or by Ctrl/⌘+Shift+↑/↓ on one of its cells. Given, the rows
     * move: the app moves the row in its own rows, from `fromIndex` to `toIndex` (its index once
     * moved: `moveRow` in `@fragiola/data-grid/local`), and the active cell follows it. Never
     * while the grid is sorted, nor for rows not loaded
     */
    onRowMove?: ((move: RowMove) => void) | undefined;
}

/** Row reorder's types (Epic #86, E2.3; a feature since Epic #151). */
export interface RowReorderTypes extends FeatureTypes {
    readonly questions: {
        /**
         * whether a row may move by its own rules: a loaded row of rows without kinds (Epic #87:
         * grouped, a row's place is its group's). Whether rows move now also takes the engine's
         * `reorderableRows` (a root's `onRowMove`) and no feature keeping them in an order of the
         * app's (a sort): a row's drag handle's `reorderable` tells all three
         */
        "row-movable": { readonly rowIndex: number };
    };
    readonly props: RowReorderProps;
}
