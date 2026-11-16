import { type HeaderCellState, headerCellPartOf } from "@fragiola/data-grid";
import type { HeaderCellInfo } from "../context";

import type { PartHookResult } from "./internal";
import { useGridView } from "./use-grid-view";

/** A header cell's state, and the props for its element. */
export function useHeaderCell<TRow>(
    cell: HeaderCellInfo<TRow>,
): PartHookResult<HeaderCellState> {
    return headerCellPartOf(useGridView<TRow>(), cell);
}
