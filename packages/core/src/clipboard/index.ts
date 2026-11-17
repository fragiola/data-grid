// @fragiola/data-grid/clipboard: the clipboard (Epic #88, E4.2; a feature since Epic #144) and the
// TSV it reads and writes. An opt-in entry point: the grid's own entry never imports it, and an
// app that never installs it never ships it.

export { parseTsv, toTsv } from "./clipboard";
export { clipboard } from "./feature";
export { pastedRange, rangeText } from "./text";
export type { ClipboardProps, ClipboardTypes } from "./types";
