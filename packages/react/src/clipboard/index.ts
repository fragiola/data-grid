// @fragiola/data-grid-react/clipboard: copying and pasting ranges as tab-separated text (Epic #88,
// E4.2; a feature since Epic #144; it requires `cellRange()`). React has no clipboard code of its
// own: this is the core's (`@fragiola/data-grid/clipboard`). An opt-in entry point: the primitives
// never import it, and an app that never installs it never ships it.

export {
    type ClipboardProps,
    type ClipboardTypes,
    clipboard,
    parseTsv,
    pastedRange,
    rangeText,
    toTsv,
} from "@fragiola/data-grid/clipboard";
