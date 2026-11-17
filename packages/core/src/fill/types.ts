import type { RangeFill } from "../engine/types";
import type { FeatureTypes } from "../feature/feature";

/** What the fill handle adds to a root's props: a fill, told. */
export interface FillHandleProps {
    /**
     * a fill handle was dropped (Epic #88): the range (or the active cell) and the cells it
     * fills, below it or to its end. Given, cells fill: a `useFillHandle` element at the
     * range's corner drags one. The app writes the values (`repeatedFill` in
     * `@fragiola/data-grid/fill` repeats the source's); the grid writes no data
     */
    onFill?: ((fill: RangeFill) => void) | undefined;
}

/** The fill handle's types (Epic #88, E4.4; a feature since Epic #144): its props only. */
export interface FillHandleTypes extends FeatureTypes {
    readonly props: FillHandleProps;
}
