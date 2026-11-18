import type { FeatureTypes } from "../feature/feature";
import type { RowKey } from "../model/types";

/** What row grouping keeps in the model's state. */
export interface RowGroupingState {
    /**
     * the keys of the expanded row groups (Epic #87, E3.1): group rows (`GroupRow.key`) and rows
     * that expand (`RowMeta.expandable`, by their key), in the order expanded. The app's rows
     * follow them: the grid shows the rows it is given, and tells ARIA and the keys which expand
     */
    readonly expandedGroupKeys: readonly RowKey[];
}

/** The view's fields row grouping adds (`view as GridView & RowGroupingView`). */
export interface RowGroupingView {
    /**
     * the expanded row groups' keys (Epic #87): a group row, or a row that expands, shows its
     * rows while its key is here (`source.getRowMeta` says which rows expand)
     */
    readonly expandedGroupKeys: readonly RowKey[];
}

/** What row grouping adds to a root's props: the expanded row groups, controlled or not. */
export interface RowGroupingProps {
    /**
     * the expanded row groups' keys (Epic #87: a group row's `GroupRow.key`, a row that
     * expands by its key), controlled; pair it with `onExpandedGroupKeysChange`. The app's
     * rows follow them (`@fragiola/data-grid/local` does)
     */
    expandedGroupKeys?: readonly RowKey[] | undefined;
    /** the expanded row groups' keys to start with, uncontrolled */
    defaultExpandedGroupKeys?: readonly RowKey[] | undefined;
    /**
     * the expanded row groups changed (or, controlled, ask to): a group was toggled (its
     * toggle, Enter, Space, → or ←), or a command ran
     */
    onExpandedGroupKeysChange?:
        | ((expandedGroupKeys: readonly RowKey[]) => void)
        | undefined;
}

/** Row grouping's types (Epic #87, E3.1; a feature since Epic #151). */
export interface RowGroupingTypes extends FeatureTypes {
    readonly state: RowGroupingState;
    readonly options: {
        /** the keys of the row groups expanded to start with (a key given twice counts once) */
        readonly expandedGroupKeys?: readonly RowKey[] | undefined;
    };
    readonly commands: {
        /**
         * replaces the expanded row groups' keys (Epic #87, each once): group rows' keys and the
         * keys of rows that expand. A key no row has is kept: its row may come. Returns them
         */
        "row-groups.set": {
            payload: { readonly groupKeys: readonly RowKey[] };
            result: readonly RowKey[];
        };
        /**
         * expands a row group, or collapses it when it is expanded: by its row's index (a group
         * row, or a loaded row that expands) or by its key. Returns the expanded row groups' keys
         */
        "row-groups.toggle": {
            payload:
                | { readonly rowIndex: number; readonly groupKey?: undefined }
                | { readonly groupKey: RowKey; readonly rowIndex?: undefined };
            result: readonly RowKey[];
        };
    };
    readonly queries: {
        /** the expanded row groups' keys (Epic #87), in the order they were expanded */
        "expanded-group-keys": {
            payload: undefined;
            result: readonly RowKey[];
        };
    };
    readonly questions: {
        /**
         * whether the row heads an expanded row group (Epic #87): a group row, or a row that
         * expands, its key among the expanded group keys
         */
        "row-group-expanded": { readonly rowIndex: number };
    };
    readonly props: RowGroupingProps;
}
