import type { ExampleMeta } from "../meta-types";

export default {
    title: "Custom navigation",
    description:
        "Replacing a key: Tab can leave the grid, move across the row and on to the next one, or loop over the row, all from a cell's own onKeyDown.",
    category: "keyboard",
    order: 2,
    features: ["onKeyDown", "preventDefault", "useDataGrid", "model.run"],
    docs: "/docs/concepts/keyboard",
} satisfies ExampleMeta;
