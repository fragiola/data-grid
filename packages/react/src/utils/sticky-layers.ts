/**
 * The layers the sticky parts take (Epic #89, E5.2): the header above the summary rows, both above
 * the body (no `z-index`: a layer whose transform makes it a stacking context, its pinned cells'
 * stacking the app's inside it).
 */
export const HEADER_LAYER = 2;
export const SUMMARY_LAYER = 1;
