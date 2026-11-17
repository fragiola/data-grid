// @fragiola/data-grid-vue/clipboard: a range's copy and paste (Epic #88, a feature since Epic
// #144), for an app that installs only this package. Vue has no clipboard code of its own: this
// is the core's (`@fragiola/data-grid/clipboard`, `clipboard()`, it requires `cellRange()`):
// `Root` takes `onRangePaste` and `onBeforeRangePaste`. An opt-in entry point: the primitives
// never import it.

export {
    type ClipboardProps,
    type ClipboardTypes,
    clipboard,
    parseTsv,
    pastedRange,
    rangeText,
    toTsv,
} from "@fragiola/data-grid/clipboard";
