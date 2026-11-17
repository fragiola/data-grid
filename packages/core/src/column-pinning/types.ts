import type { FeatureTypes } from "../feature/feature";

/** The columns pinned as declared (`Column.pinned`): their keys at the start and at the end. */
export interface PinnedColumnKeys {
    /** the leading columns pinned at the start, in order */
    readonly start: readonly string[];
    /** the trailing columns pinned at the end, in order */
    readonly end: readonly string[];
}

/** Pinning's types (Epic #85, E1.1; a feature since Epic #148). */
export interface PinningTypes extends FeatureTypes {
    readonly queries: {
        /**
         * the columns pinned as declared, at the start and at the end (an engine scrolls them with
         * the others while together they are as wide as its view or wider)
         */
        "pinned-column-keys": { payload: undefined; result: PinnedColumnKeys };
    };
}
