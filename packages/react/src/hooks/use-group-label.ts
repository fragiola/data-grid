import { GROUP_LABEL_ATTRIBUTE } from "@fragiola/data-grid";
import { type HeaderCellInfo, useRootGrid } from "../context";
import { layerRef } from "../utils/layer-ref";
import { dataAttributes } from "../utils/use-render";

import type { PartHookResult } from "./internal";

/** The state of a group's label: the key of the header cell it labels. */
export interface GroupLabelState {
    readonly groupKey: string;
}

/**
 * A group's label (Epic #85, E1.3): the props of an element the app renders inside a group's
 * header cell (its name, its toggle), which stays in view while the group scrolls: sticky in the
 * cell, at the start of the columns that scroll (right of the pinned ones), within the cell's box,
 * so it never leaves its group. The engine writes its inline start inset (`left`, `right` right to
 * left), never React: give it no inset of your own. It must be narrower than its cell (an
 * `inline-block`, a flex item): only then is there room to move, and nothing between it and the
 * cell may clip (`overflow` other than `visible` or `clip`). In a pinned group it stays where it is.
 */
export function useGroupLabel<TRow>(
    cell: HeaderCellInfo<TRow>,
): PartHookResult<GroupLabelState> {
    const { engine } = useRootGrid();
    return {
        state: { groupKey: cell.key },
        props: {
            ref: layerRef(engine, "label"),
            [GROUP_LABEL_ATTRIBUTE]: cell.key,
            ...dataAttributes({ "grid-part": "group-label" }),
            style: { position: "sticky" },
        },
    };
}
