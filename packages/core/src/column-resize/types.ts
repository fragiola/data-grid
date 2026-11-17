import type { ColumnResize } from "../engine/types";
import type { FeatureTypes } from "../feature/feature";
import type { ColumnWidths } from "../model/types";

/** What resizing keeps in the model's state. */
export interface ColumnResizeState {
    /** the resized columns' widths, over their `width` (a resizable column's only count) */
    readonly columnWidths: ColumnWidths;
}

/** What resizing's engine adds to a view: the column a drag is resizing (`ColumnResize`). */
export interface ColumnResizeView {
    /** the column a drag is resizing (W4), or `null` */
    readonly columnResize: ColumnResize | null;
}

/** What resizing adds to a root's props: the widths, controlled or not. */
export interface ColumnResizeProps {
    /**
     * the resized columns' widths in pixels, by column key, controlled; pair it with
     * `onColumnWidthsChange`. On screen a column is the first of: its width here (when it is
     * resizable, within its limits), its automatic width (`autoSize`), its flex share
     * (`flex`), its own `width`
     */
    columnWidths?: ColumnWidths | undefined;
    /** the resized columns' widths to start with, uncontrolled */
    defaultColumnWidths?: ColumnWidths | undefined;
    /**
     * the widths changed (or, controlled, ask to): a resizer was dragged (once per frame),
     * moved with the keys, fitted (a double click, Enter, `fit-columns`), or a command ran
     */
    onColumnWidthsChange?: ((columnWidths: ColumnWidths) => void) | undefined;
}

/** Column resizing's types (Epic #70, W1–W6, and fitting, Epic #80; a feature since Epic #148). */
export interface ColumnResizeTypes extends FeatureTypes {
    readonly state: ColumnResizeState;
    readonly options: {
        /** the resized columns' widths to start with (an entry that is not a size is dropped) */
        readonly columnWidths?: ColumnWidths | undefined;
    };
    readonly commands: {
        /**
         * replaces the resized columns' widths (each a size in pixels). A key that is not a column
         * is kept: the column may come back. Returns them
         */
        "column-widths.set": {
            payload: { readonly columnWidths: ColumnWidths };
            result: ColumnWidths;
        };
        /**
         * resizes a resizable column to `width`, within its limits; or a group, whose resizable
         * columns share the change in proportion to their widths, each within its limits, the
         * rest going to the next ones. Widths are whole pixels. Returns the columns' widths
         */
        "column-widths.resize": {
            payload: {
                readonly columnKey: string;
                readonly width: number;
                /**
                 * the widths an engine gives columns without an override (its
                 * `column-auto-widths`: automatic widths, flex shares): the resize starts from
                 * them, and a column back to its one needs no width. Filled by the engine on
                 * screen: an app or an adapter needn't pass it
                 */
                readonly autoWidths?: ColumnWidths | undefined;
            };
            result: ColumnWidths;
        };
        /**
         * gives a column its own `width` back, a group its columns, or, without a key, every
         * column. Returns the columns' widths
         */
        "column-widths.reset": {
            payload: { readonly columnKey?: string | undefined };
            result: ColumnWidths;
        };
    };
    readonly queries: {
        /** the resized columns' widths, by column key */
        "column-widths": { payload: undefined; result: ColumnWidths };
    };
    readonly props: ColumnResizeProps;
}
