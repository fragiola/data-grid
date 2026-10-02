import type { ExampleMeta } from "../meta-types";

export default {
    title: "Table elements",
    description:
        "The same grid rendered as a real table: table, thead, tbody, tr, th and td through render, with the same virtualization and keyboard.",
    category: "getting-started",
    order: 2,
    features: ["render", "<table>", "<th>", "<td>", "role=grid"],
    docs: "/docs/concepts/tables-or-divs",
} satisfies ExampleMeta;
