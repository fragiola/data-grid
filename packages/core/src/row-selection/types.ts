import type { FeatureTypes } from "../feature/feature";
import type {
    NoPayload,
    RowKey,
    RowSelectable,
    RowSelection,
    SelectionAnchor,
} from "../model/types";

/** What row selection keeps in the model's state (R1–R9). */
export interface RowSelectionState<TRow = unknown> {
    /** how rows are selected; `undefined`: they are not (R2) */
    readonly rowSelection: RowSelection | undefined;
    /**
     * the keys of the selected rows, in the order they were selected (R1). A key whose row is
     * not loaded, or not in the data, stays
     */
    readonly selectedRowKeys: readonly RowKey[];
    /** whether a loaded row can be selected; `undefined`: every row can (R5) */
    readonly isRowSelectable: RowSelectable<TRow> | undefined;
    /** where a range starts: the row last toggled without `extend` (R3) */
    readonly selectionAnchor: SelectionAnchor | null;
}

/** What row selection adds to a root's props: the mode, the filter, the keys (controlled or not). */
export interface RowSelectionProps<TRow = unknown> {
    /**
     * how rows are selected: one at a time or many (default: not at all). Selected rows carry
     * `data-selected` and `aria-selected`; Shift+Space, Shift+Up/Down and Ctrl/⌘+A select
     */
    rowSelection?: RowSelection | undefined;
    /** whether a loaded row can be selected (default: every row can) */
    isRowSelectable?: RowSelectable<TRow> | undefined;
    /**
     * the selected rows' keys (a row's `rowKey`, else its index), controlled; pair it with
     * `onSelectedRowKeysChange`
     */
    selectedRowKeys?: readonly RowKey[] | undefined;
    /** the selected rows' keys to start with, uncontrolled */
    defaultSelectedRowKeys?: readonly RowKey[] | undefined;
    /** the selection changed (or, controlled, asks to): a row was toggled, or a command ran */
    onSelectedRowKeysChange?:
        | ((selectedRowKeys: readonly RowKey[]) => void)
        | undefined;
}

/** Row selection's types (Epic #57, R1–R9; a feature since Epic #144). */
export interface RowSelectionTypes extends FeatureTypes {
    readonly state: RowSelectionState<this["row"]>;
    readonly options: RowSelectionOptions<this["row"]>;
    readonly commands: RowSelectionCommands<this["row"]>;
    readonly queries: {
        /** how rows are selected; `undefined` when they are not */
        "row-selection": {
            payload: undefined;
            result: RowSelection | undefined;
        };
        /** the selected rows' keys, in the order they were selected */
        "selected-row-keys": { payload: undefined; result: readonly RowKey[] };
        /** where the next range starts: the anchor, while its key is still at its index */
        "selection-anchor": {
            payload: undefined;
            result: SelectionAnchor | null;
        };
    };
    readonly questions: {
        /** whether the row is selected: rows are selectable, it is loaded and its key selected */
        "row-selected": { readonly rowIndex: number };
        /** whether the row can be selected: rows are selectable, it is loaded and not refused */
        "row-selectable": { readonly rowIndex: number };
    };
    readonly props: RowSelectionProps<this["row"]>;
}

/** What `createDataGridModel` takes for row selection. */
export interface RowSelectionOptions<TRow = unknown> {
    /** how rows are selected: one at a time, or many (default: not at all) */
    rowSelection?: RowSelection | undefined;
    /** the keys of the rows selected to start with (a key given twice counts once) */
    selectedRowKeys?: readonly RowKey[];
    /** whether a loaded row can be selected (default: every row can) */
    isRowSelectable?: RowSelectable<TRow> | undefined;
}

/** Row selection's commands. */
export interface RowSelectionCommands<TRow = unknown> {
    /**
     * replaces the selected rows' keys (each once; in single mode, the last one only): the app's
     * keys, as given (`isRowSelectable` is not asked: a key's row may not be loaded). Returns them
     */
    "selected-rows.set": {
        payload: { readonly rowKeys: readonly RowKey[] };
        result: readonly RowKey[];
    };
    /**
     * selects a row, or clears it when it is selected: by its index (a loaded row) or by its key.
     * A group row (Epic #87, multiple mode) selects its rows' keys (`GroupRow.rowKeys`), or clears
     * them all when every one is selected; with `extend`, a range from the anchor to it.
     * By index, the row becomes the anchor; a row that cannot be selected is never added (it can
     * be cleared). By key, the row is not looked for: the key is the app's, as with `set`. With
     * `extend` (multiple mode; single mode toggles), every selectable row from the anchor to it
     * takes the anchor's state instead, and the anchor stays (without one, a toggle); a row not
     * loaded on the way
     * refuses it all (`not_loaded`). In single mode, selecting a row clears the others. Returns
     * the selected rows' keys and the anchor it leaves (what a controlled root keeps of a toggle
     * its parent answers)
     */
    "selected-rows.toggle": {
        payload:
            | {
                  readonly rowIndex: number;
                  readonly extend?: boolean | undefined;
                  readonly rowKey?: undefined;
              }
            | {
                  readonly rowKey: RowKey;
                  readonly rowIndex?: undefined;
                  readonly extend?: undefined;
              };
        result: {
            readonly rowKeys: readonly RowKey[];
            readonly anchor: SelectionAnchor | null;
        };
    };
    /**
     * makes a loaded row the anchor, where the next range starts, changing no selection: a range
     * from it selects its rows, or clears them with `selected: false`. Returns the anchor
     */
    "selection-anchor.set": {
        payload: {
            readonly rowIndex: number;
            readonly selected?: boolean | undefined;
        };
        result: SelectionAnchor;
    };
    /** leaves no anchor: the next range is a toggle */
    "selection-anchor.clear": {
        payload: NoPayload;
        result: undefined;
    };
    /**
     * selects every selectable row (multiple mode), keeping the keys already selected; a row not
     * loaded refuses it all (`not_loaded`): its key is unknown. Returns the selected rows' keys
     */
    "selected-rows.select-all": {
        payload: NoPayload;
        result: readonly RowKey[];
    };
    /**
     * changes how rows are selected: the mode (`null`: not at all) and which rows can be. Single
     * mode keeps the last selected key only
     */
    "row-selection.set": {
        payload: {
            readonly rowSelection?: RowSelection | null | undefined;
            readonly isRowSelectable?: RowSelectable<TRow> | null | undefined;
        };
        result: undefined;
    };
}
