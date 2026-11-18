import type { FeatureTypes } from "../feature/feature";
import type { DetailHeight, RowKey } from "../model/types";

/** What row expansion keeps in the model's state. */
export interface RowExpansionState {
    /**
     * the keys of the expanded rows, in the order they were expanded (M1). A key whose row is not
     * loaded, or not in the data, stays: its row expands once it is there
     */
    readonly expandedRowKeys: readonly RowKey[];
    /**
     * the indexes of the rows shown expanded, ascending: each loaded, its key in
     * `expandedRowKeys`. Derived from the data and the keys, as the data contract tells them
     */
    readonly expandedRows: readonly number[];
    /**
     * where each expanded key's row was last seen (one cache per grid, checked before it is used):
     * a key is looked for there first
     */
    readonly expandedRowHints: Map<RowKey, number>;
}

/** What row expansion adds to a root's props: the expanded rows and their details' heights. */
export interface RowExpansionProps<TRow> {
    /**
     * the expanded rows' keys (a row's `rowKey`, else its index), controlled; pair it with
     * `onExpandedRowKeysChange`. An expanded row shows its row detail (the adapters'
     * `RowDetail`, from their `/row-expansion`)
     */
    expandedRowKeys?: readonly RowKey[] | undefined;
    /** the expanded rows' keys to start with, uncontrolled */
    defaultExpandedRowKeys?: readonly RowKey[] | undefined;
    /** the expanded rows changed (or, controlled, ask to): a row was toggled, or a command ran */
    onExpandedRowKeysChange?:
        | ((expandedRowKeys: readonly RowKey[]) => void)
        | undefined;
    /**
     * an expanded row's detail height in pixels, or a function of the row (default 300); `"auto"`:
     * as tall as its content, measured once rendered (Epic #86)
     */
    detailHeight?: DetailHeight<TRow> | undefined;
    /** a measured detail's height until it is measured, in pixels (default 300) */
    estimatedDetailHeight?: number | undefined;
}

/** Row expansion's types (M1–M4; a feature since Epic #151). */
export interface RowExpansionTypes extends FeatureTypes {
    readonly state: RowExpansionState;
    readonly options: RowExpansionOptions<this["row"]>;
    readonly commands: RowExpansionCommands;
    readonly queries: RowExpansionQueries<this["row"]>;
    readonly questions: {
        /** whether the row shows its detail: loaded, and its key expanded */
        "row-expanded": { readonly rowIndex: number };
    };
    readonly props: RowExpansionProps<this["row"]>;
}

/** What `createDataGridModel` takes for row expansion. */
export interface RowExpansionOptions<TRow> {
    /** the keys of the rows expanded to start with (a key given twice counts once) */
    readonly expandedRowKeys?: readonly RowKey[] | undefined;
    /**
     * an expanded row's detail height in pixels, or a function of the row (default 300);
     * `"auto"`: as tall as its content, measured by an engine once rendered
     */
    readonly detailHeight?: DetailHeight<TRow> | undefined;
    /** a measured detail's height until it is measured, in pixels (default 300) */
    readonly estimatedDetailHeight?: number | undefined;
}

/** Row expansion's commands. */
export interface RowExpansionCommands {
    /**
     * replaces the expanded rows' keys (each once). A key whose row is not loaded is kept: the
     * row expands once it is. Returns them
     */
    "expanded-rows.set": {
        payload: { readonly rowKeys: readonly RowKey[] };
        result: readonly RowKey[];
    };
    /**
     * expands a row, or collapses it when it is expanded: by its index (a loaded row; its key
     * is kept) or by its key. Returns the expanded rows' keys
     */
    "expanded-rows.toggle": {
        payload:
            | { readonly rowIndex: number; readonly rowKey?: undefined }
            | { readonly rowKey: RowKey; readonly rowIndex?: undefined };
        result: readonly RowKey[];
    };
}

/** Row expansion's `get` keys. */
export interface RowExpansionQueries<TRow> {
    /** the expanded rows' keys, in the order they were expanded */
    "expanded-row-keys": { payload: undefined; result: readonly RowKey[] };
    /** the indexes of the rows shown expanded (loaded, their key expanded), ascending */
    "expanded-rows": { payload: undefined; result: readonly number[] };
    /** an expanded row's detail height: a number, a function of the row, or `"auto"` */
    "detail-height": {
        payload: undefined;
        result: DetailHeight<TRow>;
    };
}
