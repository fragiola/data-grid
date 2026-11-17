import type { FeatureTypes } from "../feature/feature";
import type { CellPosition, NoPayload } from "../model/types";
import type { Range } from "../viewport/window";
import type { Direction } from "./navigation";

/** What navigation adds to a root's props: the active cell, controlled or not. */
export interface NavigationProps {
    /** the active cell, controlled (`null` for none); pair it with `onActivePositionChange` */
    activePosition?: CellPosition | null | undefined;
    /** the active cell to start with, uncontrolled */
    defaultActivePosition?: CellPosition | null | undefined;
    /** the active cell changed (or, controlled, asks to) */
    onActivePositionChange?:
        | ((position: CellPosition | null) => void)
        | undefined;
}

/**
 * Navigation's types (D11; a feature since Epic #144): the active position's commands and keys.
 * The active position itself is the core's state (`activePosition`, its rules on the grid's
 * shape the core's): navigation is what sets it.
 */
export interface NavigationTypes extends FeatureTypes {
    readonly state: {
        /** the active cell, `null` for none (the core's field: navigation sets it) */
        readonly activePosition: CellPosition | null;
    };
    readonly options: {
        /** the active cell to start with (kept inside the grid once the rows are given) */
        readonly activePosition?: CellPosition | null | undefined;
    };
    readonly commands: {
        /**
         * makes a cell the active one (rows -1 and above are the header, the top summary rows before
         * it, the bottom ones from `rowCount` on); a position inside a cell's span activates that
         * cell, at its own position
         */
        "active-position.set": {
            payload: CellPosition;
            result: CellPosition;
        };
        /** leaves no cell active */
        "active-position.clear": {
            payload: NoPayload;
            result: undefined;
        };
        /**
         * moves the active cell (the engine supplies `pageSize`, the rows in view, and
         * `visibleColumns`, where a move down from a group lands)
         */
        "active-position.move": {
            payload: {
                readonly direction: Direction;
                readonly pageSize?: number | undefined;
                readonly visibleColumns?: Range | undefined;
            };
            result: CellPosition;
        };
    };
    readonly queries: {
        /** the active cell, or `null` */
        "active-position": { payload: undefined; result: CellPosition | null };
    };
    readonly questions: {
        /**
         * whether the cell is the active one: for a header cell, any position inside its span (a
         * group's columns, a column's rows)
         */
        "cell-active": CellPosition;
        /** whether the row holds the active cell */
        "row-active": { readonly rowIndex: number };
    };
    readonly props: NavigationProps;
}
