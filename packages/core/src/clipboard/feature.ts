import { isElement } from "../engine/dom";
import { shortcutLetter } from "../engine/shortcuts";
import {
    type DataGridFeature,
    defineFeature,
    type FeatureState,
} from "../feature/feature";
import { selectedArea } from "../model/range";
import type { CellRange, RangePaste } from "../model/types";
import type { CellRangeTypes } from "../range/types";
import { parseTsv } from "./clipboard";
import {
    type HeldSelection,
    holdSelection,
    releaseSelection,
    selectedIn,
} from "./held-selection";
import { pastedRange, rangeText } from "./text";
import type { ClipboardTypes } from "./types";

// The clipboard (Epic #88, E4.2; a feature since Epic #144, requiring cell ranges): a copy in the
// grid writes its range (else the active body cell) as TSV, a paste parses the clipboard's text
// and tells the engine's `range-paste` event (`onBeforeRangePaste`, then `onRangePaste`, on a
// root). No permission: the page's own events, every engine. The grid writes no data.

/** The state as the clipboard reads it: the range's (the feature it requires). */
type State = FeatureState<CellRangeTypes>;

/** The clipboard feature's definition: every grid installing it shares it. */
const CLIPBOARD = defineFeature<ClipboardTypes>({
    name: "clipboard",
    requires: ["cellRange"],
    engine: ({ model, engine }) => {
        /** the range's state, read through the feature it requires */
        const stateOf = () => model.state as unknown as State;
        /** the selection a copy or a paste holds in a cell (`selectForClipboard`) */
        let clipboardSelection: HeldSelection | null = null;

        /** Puts the selection back as it was before `selectForClipboard`, and removes its node. */
        const endClipboardSelection = () => {
            const held = clipboardSelection;
            if (!held) return;
            clipboardSelection = null;
            releaseSelection(held);
        };

        /**
         * Ctrl/⌘+C or Ctrl/⌘+V on one of the grid's cells (E4.2), its keydown never prevented:
         * the page's own `copy` or `paste` follows, which WebKit fires (a copy) only while
         * something is selected, and Firefox fires at the selection, not at the focused cell
         * (Epic #89). A node of the cell's own holds the selection (`holdSelection`) until the
         * event (`copy`, `paste`) or, without one, the next task (`endClipboardSelection`, which
         * puts the selection back); for a copy, text selected inside the cell is left to copy as
         * it is.
         */
        const selectForClipboard = (cell: Element, copying: boolean) => {
            const doc = cell.ownerDocument;
            const selection = doc.getSelection();
            if (!selection || (copying && selectedIn(selection, cell))) return;
            endClipboardSelection();
            clipboardSelection = holdSelection(cell, selection);
            doc.defaultView?.setTimeout(endClipboardSelection, 0);
        };

        /**
         * The cells a copy or a paste is for (E4.2), cells selectable: the selected range, else
         * the active body cell, when the event comes from one of the grid's cells itself (a field
         * inside one keeps its own clipboard; a nested grid's cell is that grid's); else `null`.
         */
        const clipboardRange = (event: ClipboardEvent): CellRange | null => {
            // the grid's own selection (`selectForClipboard`): the event comes from its node, in
            // the cell
            const held = clipboardSelection?.node;
            const target =
                held && isElement(event.target) && held.contains(event.target)
                    ? held.parentElement
                    : event.target;
            const state = stateOf();
            if (
                !state.cellSelection ||
                event.defaultPrevented ||
                !event.clipboardData ||
                !isElement(target) ||
                !engine.isCellElement(target)
            ) {
                return null;
            }
            return selectedArea(state);
        };

        return {
            // Ctrl/⌘+C or Ctrl/⌘+V on one of its cells, something to copy or paste into: the
            // page's own copy or paste follows, with a selection in the cell; the key is never the
            // grid's
            beforeKeydown: (event, target) => {
                const ctrl = event.ctrlKey || event.metaKey;
                const letter = ctrl ? shortcutLetter(event) : "";
                const state = stateOf();
                if (
                    (letter === "c" || letter === "v") &&
                    !event.shiftKey &&
                    !event.altKey &&
                    !event.defaultPrevented &&
                    state.cellSelection &&
                    selectedArea(state)
                ) {
                    selectForClipboard(target, letter === "c");
                }
            },
            // a copy in the grid: its range's cells as TSV, on the clipboard
            copy: (event) => {
                const range = clipboardRange(event);
                endClipboardSelection();
                if (!range) return false;
                event.clipboardData?.setData(
                    "text/plain",
                    rangeText(stateOf(), range),
                );
                event.preventDefault();
                return true;
            },
            // a paste in the grid: the clipboard's text parsed, landing at the range's first cell
            // (else the active cell), told as a `range-paste` event; nothing for no text
            paste: (event) => {
                const range = clipboardRange(event);
                endClipboardSelection();
                const values = range
                    ? parseTsv(event.clipboardData?.getData("text/plain") ?? "")
                    : [];
                const pasted =
                    range && pastedRange(stateOf(), range.anchor, values);
                if (!pasted) return false;
                event.preventDefault();
                engine.emit("range-paste", pasted);
                return true;
            },
            // a copy's or a paste's selection never outlives the viewport
            attach: () => endClipboardSelection,
        };
    },
    root: {
        props: ["onRangePaste", "onBeforeRangePaste"],
        // a paste: asked first, then told
        events: (engine, props) => {
            engine.subscribe("range-paste", (paste: RangePaste) => {
                const { onBeforeRangePaste, onRangePaste } = props();
                if (onBeforeRangePaste?.(paste) === false) return;
                onRangePaste?.(paste);
            });
        },
    },
});

/**
 * The clipboard (`@fragiola/data-grid/clipboard`): install it on a grid with cell ranges
 * (`features: [navigation(), cellRange(), clipboard()]`) for Ctrl/⌘+C to copy the range as TSV
 * and Ctrl/⌘+V to paste into it (`onRangePaste`).
 */
export function clipboard(): DataGridFeature<ClipboardTypes> {
    return CLIPBOARD;
}
