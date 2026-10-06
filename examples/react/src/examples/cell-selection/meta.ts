import type { ExampleMeta } from "../meta-types";

export default {
    title: "Cell selection",
    description:
        "A year's budget selected by range with Shift and the keys or by dragging, summed by the app, copied as tab-separated text and pasted back into its own rows.",
    category: "keyboard",
    order: 4,
    features: [
        "cellSelection",
        "selectedRange",
        "data-selected-cell",
        "data-range-edge",
        "getCopyText",
        "onRangePaste",
        "onBeforeRangePaste",
    ],
    docs: "/docs/concepts/cell-selection",
} satisfies ExampleMeta;
