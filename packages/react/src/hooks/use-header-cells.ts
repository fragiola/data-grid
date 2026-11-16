import type { HeaderCellInfo, HeaderRowInfo } from "../context";

import { useHeaderRowOf } from "./internal";

/**
 * The header cells a render shows in a header row: the given one, else the one rendering (inside
 * `DataGrid.HeaderRow`), else the last (a grid without groups has only that one).
 */
export function useHeaderCells<TRow = unknown>(
    row?: HeaderRowInfo<TRow>,
): readonly HeaderCellInfo<TRow>[] {
    return useHeaderRowOf(row)?.cells ?? [];
}
