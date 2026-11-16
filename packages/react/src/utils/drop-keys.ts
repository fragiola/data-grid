/** The layers' `transform` is the engine's: a consumer's would move the rows. */
export const LAYER_KEYS = ["transform"] as const;

/**
 * A pinned cell's inline start inset (`left`, right to left `right`) is the engine's, and the
 * other insets and a `transform` would let it
 * move from its place (`position: sticky` obeys every inset it is given).
 */
export const PINNED_KEYS = [
    "transform",
    "left",
    "right",
    "top",
    "bottom",
    "inset",
    "insetInline",
    "insetInlineStart",
    "insetInlineEnd",
    "insetBlock",
    "insetBlockStart",
    "insetBlockEnd",
] as const;
