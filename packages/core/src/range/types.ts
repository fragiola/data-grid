import type { FeatureTypes } from "../feature/feature";
import type {
    CellPosition,
    CellRange,
    CellSelection,
    NoPayload,
    RangeKeys,
} from "../model/types";
import type { Direction } from "../navigation/navigation";

/** What cell ranges keep in the model's state (Epic #88, E4.1). */
export interface CellRangeState {
    /** how cells are selected; `undefined`: they are not (Epic #88, E4.1) */
    readonly cellSelection: CellSelection | undefined;
    /**
     * the selected range of body cells, inside the grid's rows and columns; `null` for none (the
     * active cell alone is what a copy copies)
     */
    readonly selectedRange: CellRange | null;
    /** the keys at the range's corners (`null` without one): new rows or columns there end it */
    readonly selectedRangeKeys: RangeKeys | null;
}

/** What cell ranges add to a root's props: the mode, the range (controlled or not). */
export interface CellRangeProps {
    /**
     * how cells are selected (Epic #88): a range of body cells (default: not at all). Shift
     * with the navigation keys, a press dragged across cells and Shift+click select one; its
     * cells carry `data-selected-cell` and `aria-selected`, its edges' cells
     * `data-range-edge`; Ctrl/⌘+C copies it as TSV and Ctrl/⌘+V pastes into it
     * (`onRangePaste`)
     */
    cellSelection?: CellSelection | undefined;
    /**
     * the selected range of cells (`{ anchor, focus }`, body cells), controlled (`null` for
     * none); pair it with `onSelectedRangeChange`
     */
    selectedRange?: CellRange | null | undefined;
    /** the selected range to start with, uncontrolled */
    defaultSelectedRange?: CellRange | null | undefined;
    /** the selected range changed (or, controlled, asks to): a key, a drag, a click or a command */
    onSelectedRangeChange?: ((range: CellRange | null) => void) | undefined;
}

/** Cell ranges' types (Epic #88, E4.1; a feature since Epic #144). */
export interface CellRangeTypes extends FeatureTypes {
    readonly state: CellRangeState;
    readonly options: {
        /** how cells are selected: a range of them (default: not at all) */
        cellSelection?: CellSelection | undefined;
        /** the range of cells selected to start with (kept inside the grid's body; default none) */
        selectedRange?: CellRange | null | undefined;
    };
    readonly commands: {
        /**
         * changes how cells are selected (Epic #88): a range of them, or `null` for not at all (the
         * range goes). Returns it
         */
        "cell-selection.set": {
            payload: { readonly cellSelection: CellSelection | null };
            result: CellSelection | undefined;
        };
        /**
         * selects the body cells from `anchor` to `focus` (cells selectable, both body cells: rows 0
         * to the last, columns of the grid). Returns the range
         */
        "selected-range.set": {
            payload: CellRange;
            result: CellRange;
        };
        /**
         * moves the range's focus, its anchor staying: to a body cell, or a move from the focus
         * (`direction`, as `active-position.move`'s, kept in the body; `pageSize` rows a page). Without
         * a range, it starts at the active cell (a body cell), else at the cell given. Returns the range
         */
        "selected-range.extend": {
            payload:
                | {
                      readonly rowIndex: number;
                      readonly columnIndex: number;
                      readonly direction?: undefined;
                  }
                | {
                      readonly direction: Direction;
                      readonly pageSize?: number | undefined;
                      readonly rowIndex?: undefined;
                      readonly columnIndex?: undefined;
                  };
            result: CellRange;
        };
        /** selects every body cell, from the first to the last. Returns the range */
        "selected-range.select-all": {
            payload: NoPayload;
            result: CellRange;
        };
        /** leaves no range selected */
        "selected-range.clear": {
            payload: NoPayload;
            result: undefined;
        };
    };
    readonly queries: {
        /** how cells are selected (Epic #88); `undefined` when they are not */
        "cell-selection": {
            payload: undefined;
            result: CellSelection | undefined;
        };
        /** the selected range of cells, or `null` */
        "selected-range": { payload: undefined; result: CellRange | null };
    };
    readonly questions: {
        /**
         * whether a body cell is in the selected range (Epic #88): a cell spanning columns is while
         * any of its columns is
         */
        "cell-selected": CellPosition;
    };
    readonly props: CellRangeProps;
}
