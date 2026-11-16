// Type fixtures: checked by `tsc`, never run. `@ts-expect-error` marks what must not compile.

import type { GridRootPropName, GridRootProps } from "../../src";

// `GRID_ROOT_PROPS` lists every root prop (what an adapter's root takes, and leaves off its
// element): a prop added to `GridRootProps` and not listed fails here
type Unlisted = Exclude<
    keyof GridRootProps<unknown, unknown>,
    GridRootPropName
>;
export const everyRootPropListed: [Unlisted] extends [never] ? true : Unlisted =
    true;
