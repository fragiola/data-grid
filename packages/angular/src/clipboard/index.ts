// @fragiola/data-grid-angular/clipboard: the clipboard (Epic #88, E4.2; a feature since Epic
// #144), for an app that installs only this package: the core's (`@fragiola/data-grid/clipboard`:
// the TSV it reads and writes), and the root's paste input and output. An opt-in entry point: the
// directives never import it, and an app that never installs the clipboard never ships it. It
// requires cell ranges (`cellRange()`).

import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type { DataGridFeature, RangePaste } from "@fragiola/data-grid";
import type {
    ClipboardProps,
    ClipboardTypes,
} from "@fragiola/data-grid/clipboard";
import { DataGridRoot } from "@fragiola/data-grid-angular";

export {
    type ClipboardProps,
    type ClipboardTypes,
    clipboard,
    parseTsv,
    pastedRange,
    rangeText,
    toTsv,
} from "@fragiola/data-grid/clipboard";

/**
 * The root's paste (React's `onRangePaste` and `onBeforeRangePaste` on `Root`, typed by
 * `clipboard()`): on the root's element, with `clipboard()` in its features (`<div dataGridRoot
 * [features]="features" dataGridClipboard (rangePaste)="pasted($event)">`). Without `clipboard()`
 * installed, the core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridClipboard]",
    exportAs: "dataGridClipboard",
})
export class DataGridClipboard {
    /** asked before a paste is told (`rangePaste`): `false` refuses it */
    readonly beforeRangePaste = input<
        ((paste: RangePaste) => boolean | undefined) | undefined
    >(undefined);
    /**
     * values were pasted into the grid: the range they land in and the values parsed from the
     * clipboard's text (TSV), once `beforeRangePaste` let it. The app writes them into its rows
     */
    readonly rangePaste = output<RangePaste>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly pasted = (paste: RangePaste) =>
        this.rangePaste.emit(paste);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<ClipboardTypes>]>(
                (): ClipboardProps => ({
                    onRangePaste: this.pasted,
                    onBeforeRangePaste: this.beforeRangePaste(),
                }),
                { inputs: true },
            ),
        );
    }
}
