import type { FeatureTypes } from "../feature/feature";
import type { RangePaste } from "../model/types";

/** What the clipboard adds to a root's props: a paste, asked and told. */
export interface ClipboardProps {
    /**
     * values were pasted into the grid (Ctrl/⌘+V on one of its cells, `cellSelection` set): the
     * range they land in, from the selected range's first cell (else the active cell), and
     * the values parsed from the clipboard's text (TSV), as many as land. The app writes them
     * into its rows: the grid writes nothing
     */
    onRangePaste?: ((paste: RangePaste) => void) | undefined;
    /**
     * asked before `onRangePaste`, with the same paste: `false` refuses it (`onRangePaste` is
     * not called), as a middleware would
     */
    onBeforeRangePaste?:
        | ((paste: RangePaste) => boolean | undefined)
        | undefined;
}

/** The clipboard's types (Epic #88, E4.2; a feature since Epic #144): its props only. */
export interface ClipboardTypes extends FeatureTypes {
    readonly props: ClipboardProps;
}
