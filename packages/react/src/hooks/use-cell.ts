import type { CellState } from "@fragiola/data-grid";
import type { CellInfo } from "../context";

import { type PartHookResult, useCellPart } from "./internal";

/**
 * A body cell's state, and the props for its element: the roving tab stop, ARIA, `data-*`. A cell
 * spanning columns (Epic #85) is as wide as them, with `aria-colspan`.
 */
export function useCell<TRow>(cell: CellInfo<TRow>): PartHookResult<CellState> {
    const { state, props } = useCellPart(cell);
    return { state, props };
}
