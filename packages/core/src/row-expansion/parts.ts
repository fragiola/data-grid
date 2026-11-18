import {
    DETAIL_AREA,
    dataAttributes,
    type GridRowInfo,
    inlineSide,
    type PartResult,
} from "../adapter/props";
import {
    cellRole,
    measuredRow,
    rowDetailBox,
    rowDisplay,
} from "../engine/geometry";
import type { GridView } from "../engine/types";

// A row's detail (M3, M4; row expansion's since Epic #151): the element an expanded row shows
// below its cells. Its box on the rows' axis (`rowDetailBox`) and its measuring (the engine's
// `detail` layer) are the core's.

/** The state of a row's detail. */
export interface RowDetailState {
    readonly rowIndex: number;
    /** its row is expanded: the detail renders only meanwhile */
    readonly expanded: boolean;
    /** its height: the detail height the grid was given for this row (0 while collapsed) */
    readonly height: number;
}

/** A row's detail's state, and its box while its row is expanded (`rowDetailBox`). */
export interface RowDetailPart {
    readonly state: RowDetailState;
    readonly box: ReturnType<typeof rowDetailBox>;
}

/** A row's detail's state (0 tall while collapsed), and its box while its row is expanded. */
export function rowDetailPart<TRow, TNode>(
    view: GridView<TRow, TNode>,
    rowIndex: number,
): RowDetailPart {
    const box = rowDetailBox(view, rowIndex);
    return {
        state: { rowIndex, expanded: box !== null, height: box?.height ?? 0 },
        box,
    };
}

/**
 * A detail's ARIA (M4): one cell of its row spanning every column, so expanding a row changes no
 * row count or index.
 */
export function ariaRowDetail<TRow, TNode>(
    view: GridView<TRow, TNode>,
): { readonly "aria-colindex": number; readonly "aria-colspan"?: number } {
    return {
        "aria-colindex": 1,
        ...(view.columnCount > 1 ? { "aria-colspan": view.columnCount } : {}),
    };
}

/**
 * A row's detail (M3): its state, and the props for its element (rendered only while
 * `state.expanded`). One cell of its row spanning every column (M4), in the row's flow below its
 * cells, sticky at the view's start (the engine writes its `left`), as wide as the visible area.
 */
export function rowDetailPartOf<TRow, TNode>(
    view: GridView<TRow, TNode>,
    row: GridRowInfo<TRow>,
): PartResult<RowDetailState> {
    const { state, box } = rowDetailPart(view, row.rowIndex);
    if (!box) return { state, props: { style: {} } };
    const flex = rowDisplay(view) === "flex";
    // a measured detail is as tall as its content (Epic #86)
    const height = view.measuredDetails ? {} : { height: box.height };
    return {
        state,
        props: {
            role: cellRole(view),
            ...ariaRowDetail(view),
            ...dataAttributes({
                "grid-part": "row-detail",
                "row-index": row.rowIndex,
            }),
            // in a measured row, the area below its cells'
            style: measuredRow(view, row.loaded)
                ? {
                      position: "sticky",
                      display: "block",
                      gridArea: DETAIL_AREA,
                      width: box.width,
                      ...height,
                      boxSizing: "border-box",
                  }
                : {
                      position: "sticky",
                      display: "block",
                      marginTop: box.top,
                      // in a row of pinned cells (flex), from the row's start, never shrunk,
                      // and measured, never stretched to the row's height
                      ...(flex
                          ? {
                                [inlineSide(view.direction, "margin")]:
                                    box.start,
                                flexShrink: 0,
                                ...(view.measuredDetails
                                    ? { alignSelf: "flex-start" as const }
                                    : {}),
                            }
                          : {}),
                      width: box.width,
                      ...height,
                      boxSizing: "border-box",
                  },
        },
    };
}
