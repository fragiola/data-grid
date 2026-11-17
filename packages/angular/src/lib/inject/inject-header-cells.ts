import { computed, inject, type Signal } from "@angular/core";
import {
    DATA_GRID_HEADER_ROW,
    type HeaderCellInfo,
    type HeaderRowInfo,
} from "../context";
import { injectGridView } from "./inject-data-grid";
import { type ValueOrSignal, valueNow } from "./internal";

/**
 * The header cells of a header row (React's `useHeaderCells`): the given one, else the one around
 * (`[dataGridHeaderRow]`), else the last (a grid without groups has only that one).
 */
export function injectHeaderCells<TRow = unknown>(
    row?: ValueOrSignal<HeaderRowInfo<TRow> | undefined>,
): Signal<readonly HeaderCellInfo<TRow>[]> {
    const view = injectGridView<TRow>();
    const around = inject(DATA_GRID_HEADER_ROW, { optional: true });
    return computed(() => {
        const { headerRows } = view();
        // the header row around was rendered for this grid's row type
        const at =
            (row === undefined ? undefined : valueNow(row)) ??
            (around?.headerRow() as HeaderRowInfo<TRow> | undefined) ??
            headerRows[headerRows.length - 1];
        return at?.cells ?? [];
    });
}
