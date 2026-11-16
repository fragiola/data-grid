import type { RowState } from "@fragiola/data-grid";
import type { RowInfo } from "../context";

import { type PartHookResult, useRowPart } from "./internal";

/**
 * A body row's state, and the props for its element (ARIA, `data-*`, structural style). A row
 * measured (`rowHeight: "auto"`) has a `ref` among them too: the engine reads its height.
 */
export function useRow<TRow>(row: RowInfo<TRow>): PartHookResult<RowState> {
    const { state, props, ref } = useRowPart(row);
    return { state, props: ref ? { ...props, ref } : props };
}
