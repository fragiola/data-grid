// @fragiola/data-grid-angular/range: cell ranges (Epic #88, E4.1; a feature since Epic #144), for
// an app that installs only this package: the core's (`@fragiola/data-grid/range`), and the
// root's range inputs. An opt-in entry point: the directives never import it, and an app that
// never installs cell ranges never ships them. It requires navigation (`navigation()`).

import { DestroyRef, Directive, inject, input, output } from "@angular/core";
import type {
    CellRange,
    CellSelection,
    DataGridFeature,
} from "@fragiola/data-grid";
import type { CellRangeProps, CellRangeTypes } from "@fragiola/data-grid/range";
import { DataGridRoot } from "@fragiola/data-grid-angular";

export {
    type CellRangeProps,
    type CellRangeState,
    type CellRangeTypes,
    cellRange,
    keptRange,
    sameCellRange,
} from "@fragiola/data-grid/range";

/**
 * The root's cell range (React's `cellSelection`, `selectedRange`, `defaultSelectedRange` and
 * `onSelectedRangeChange` on `Root`, typed by `cellRange()`): on the root's element, with
 * `cellRange()` in its features (`<div dataGridRoot [features]="features" dataGridCellRange
 * cellSelection="range" [(selectedRange)]="range">`). Its inputs are the root's. Without
 * `cellRange()` installed, the core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridCellRange]",
    exportAs: "dataGridCellRange",
})
export class DataGridCellRange {
    /** how cells are selected: a range of body cells (default: not at all) */
    readonly cellSelection = input<CellSelection | undefined>(undefined);
    /**
     * the selected range of cells, controlled (`null` for none); pair it with
     * `selectedRangeChange` (`[(selectedRange)]`)
     */
    readonly selectedRange = input<CellRange | null | undefined>(undefined);
    /** the selected range to start with, uncontrolled */
    readonly defaultSelectedRange = input<CellRange | null | undefined>(
        undefined,
    );
    /** the selected range changed (or, controlled, asks to): a key, a drag, a click or a command */
    readonly selectedRangeChange = output<CellRange | null>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (range: CellRange | null) =>
        this.selectedRangeChange.emit(range);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<readonly [DataGridFeature<CellRangeTypes>]>(
                (): CellRangeProps => ({
                    cellSelection: this.cellSelection(),
                    selectedRange: this.selectedRange(),
                    defaultSelectedRange: this.defaultSelectedRange(),
                    onSelectedRangeChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}
