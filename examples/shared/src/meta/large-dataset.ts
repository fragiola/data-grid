import type { ExampleMeta } from "../meta-types";

export default {
    title: "A billion cells",
    description:
        "One million rows by a thousand columns, virtualized on both axes: the scrollbars cover all of it, and only the cells in view are in the page.",
    category: "virtualization",
    order: 1,
    features: [
        "rowCount",
        "getRow",
        "getValue",
        "gridRef",
        "useRowWindow",
        "useColumnWindow",
    ],
    docs: "/docs/concepts/virtualization",
    height: 560,
} satisfies ExampleMeta;
