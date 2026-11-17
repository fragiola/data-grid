import { computed, Directive, input } from "@angular/core";
import {
    type ColumnResizerState,
    columnResizerPartOf,
} from "@fragiola/data-grid";
import { type HeaderCellInfo, injectGrid } from "../context";
import { bindPart } from "../utils/helpers";
import { structuralView } from "../utils/structural";

/** The context of the `*dataGridColumnResizer` template. */
export interface ColumnResizerContext {
    /** the resizer's state (`let state`) */
    $implicit: ColumnResizerState;
    state: ColumnResizerState;
}

/**
 * A column resizer (Epic #70, W3), the app's element inside a header cell (a column's, or a
 * group's, which resizes its columns together): `<div *dataGridColumnResizer="cell"
 * aria-label="Resize"></div>`. It renders only under a cell whose columns resize, as a vertical
 * separator whose values are widths in pixels, marked for the engine, which drags it, resizes
 * with its arrows and fits its columns to their content on a double click or Enter. Its place,
 * look, name and `touch-action: none` are the app's (React's `useColumnResizer`).
 */
@Directive({ selector: "ng-template[dataGridColumnResizer]" })
export class DataGridColumnResizer<TRow = unknown> {
    /** the header cell it resizes */
    readonly dataGridColumnResizer = input.required<HeaderCellInfo<TRow>>();

    static ngTemplateContextGuard<TRow>(
        _directive: DataGridColumnResizer<TRow>,
        _context: unknown,
    ): _context is ColumnResizerContext {
        return true;
    }

    constructor() {
        const grid = injectGrid("*dataGridColumnResizer");
        const part = computed(() =>
            columnResizerPartOf(
                grid.view(),
                this.dataGridColumnResizer() as HeaderCellInfo,
            ),
        );
        const element = structuralView<ColumnResizerContext>(() => {
            const { state } = part();
            return state.resizable ? { $implicit: state, state } : null;
        });
        bindPart(
            () => grid.engine,
            element,
            () => ({ props: part().props }),
        );
    }
}
