import type { ColumnReorder } from "../engine/types";
import type { FeatureTypes } from "../feature/feature";
import type { ColumnOrder, ReorderSide } from "../model/types";

/** What reordering keeps in the model's state. */
export interface ColumnReorderState {
    /** the order columns and groups take among their siblings (empty: as declared) */
    readonly columnOrder: ColumnOrder;
}

/** What reordering's engine adds to a view: the drag of a header cell (`ColumnReorder`). */
export interface ColumnReorderView {
    /** the column or group a drag is moving, and where it would land (O4), or `null` */
    readonly columnReorder: ColumnReorder | null;
}

/** What reordering adds to a root's props: the order, controlled or not. */
export interface ColumnReorderProps {
    /**
     * the order columns and groups take among their siblings, by key, controlled; pair it
     * with `onColumnOrderChange`. The ones not listed keep their place
     */
    columnOrder?: ColumnOrder | undefined;
    /** the column order to start with, uncontrolled */
    defaultColumnOrder?: ColumnOrder | undefined;
    /**
     * the order changed (or, controlled, asks to): a header cell was dropped or moved with
     * the keys, or a command ran
     */
    onColumnOrderChange?: ((columnOrder: ColumnOrder) => void) | undefined;
}

/** Column reordering's types (Epic #75, O1–O6; a feature since Epic #148). */
export interface ColumnReorderTypes extends FeatureTypes {
    readonly state: ColumnReorderState;
    readonly options: {
        /** the column order to start with (an entry that is not a string is dropped) */
        readonly columnOrder?: ColumnOrder | undefined;
    };
    readonly commands: {
        /**
         * replaces the column order (keys of columns and groups, each once). A key that is no
         * column or group is kept: it may come back. Returns it
         */
        "column-order.set": {
            payload: { readonly columnOrder: ColumnOrder };
            result: ColumnOrder;
        };
        /**
         * moves a reorderable column or group before or after one of its siblings (its parent
         * group's entries, or the top level; that one may be fixed) within its part: one pinned
         * at the start beside another, one pinned at the end beside another, the others among
         * theirs. One landing where it is commits nothing. Returns the column order
         */
        "column-order.move": {
            payload: {
                readonly columnKey: string;
                readonly targetKey: string;
                readonly side: ReorderSide;
            };
            result: ColumnOrder;
        };
        /** gives the columns and groups their declared order back. Returns the column order */
        "column-order.reset": {
            payload: Record<string, never>;
            result: ColumnOrder;
        };
    };
    readonly queries: {
        /** the order columns and groups take among their siblings */
        "column-order": { payload: undefined; result: ColumnOrder };
    };
    readonly props: ColumnReorderProps;
}
