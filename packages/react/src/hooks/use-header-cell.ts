import {
    type HeaderCellState,
    headerCellBox,
    headerCellPart,
} from "@fragiola/data-grid";
import type { HeaderCellInfo } from "../context";

import { cellProps } from "../utils/cell-props";
import type { PartHookResult } from "./internal";
import { useGridView } from "./use-grid-view";

/** A header cell's state, and the props for its element. */
export function useHeaderCell<TRow>(
    cell: HeaderCellInfo<TRow>,
): PartHookResult<HeaderCellState> {
    const view = useGridView<TRow>();
    const part = headerCellPart(view, cell);
    return {
        state: part.state,
        // at its row's top: a cell spanning rows reaches down past it
        props: cellProps(view, part, headerCellBox(view, cell)),
    };
}
