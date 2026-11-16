import type { ExampleMeta } from "../meta-types";

export default {
    title: "Collapsible groups",
    description:
        "Sales by year, quarter and month: each group opens and closes from a toggle in its header, showing its total while closed, and its label stays in view as its columns scroll.",
    category: "columns",
    order: 6,
    features: [
        "collapsible",
        "groupShow",
        "column-groups.toggle",
        "useGroupLabel",
        "data-collapsed",
    ],
    docs: "/docs/concepts/collapsible-groups",
} satisfies ExampleMeta;
