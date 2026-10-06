import type { ExampleMeta } from "../meta-types";

export default {
    title: "Fill",
    description:
        "A shipping plan filled by dragging the handle at a range's corner down or across: the grid tells the cells to fill, and the app repeats the values or continues their series.",
    category: "keyboard",
    order: 6,
    features: [
        "useFillHandle",
        "onFill",
        "repeatedFill",
        "data-fill-target",
        "cellSelection",
    ],
    docs: "/docs/concepts/fill",
} satisfies ExampleMeta;
