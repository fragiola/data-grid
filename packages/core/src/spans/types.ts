import type { FeatureTypes } from "../feature/feature";
import type { CellSpan } from "../model/types";

/** Column spans' types (Epic #85, E1.2; a feature since Epic #151). */
export interface CellSpansTypes extends FeatureTypes {
    readonly queries: {
        /**
         * the body (or summary row) cell covering a position: its first column and how many
         * columns it spans (1 for a row not loaded, or a column without a `colSpan`)
         */
        "cell-span-by": {
            payload: {
                readonly rowIndex: number;
                readonly columnIndex: number;
            };
            result: CellSpan;
        };
    };
}
