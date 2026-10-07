import type { ExampleMeta } from "../meta-types";

export default {
    title: "Resizable grid",
    description:
        "A grid the reader resizes from its corner: the engine follows its size, rendering the rows and columns that now fit, with no size given to it in JavaScript.",
    category: "getting-started",
    order: 4,
    features: [
        "resize: both",
        "ResizeObserver",
        "gridRef",
        "useRowWindow",
        "useColumnWindow",
    ],
    docs: "/docs/getting-started/sizing",
} satisfies ExampleMeta;
