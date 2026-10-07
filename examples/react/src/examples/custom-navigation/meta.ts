import type { ExampleMeta } from "../meta-types";

export default {
    title: "Custom navigation",
    description:
        "Replacing keys: Tab can leave the grid, move across the row and on to the next one, loop over the row or down the column, and the arrows wrap at a row's ends, all from the cells' own onKeyDown.",
    category: "keyboard",
    order: 2,
    features: ["onKeyDown", "preventDefault", "useDataGrid", "model.run"],
    docs: "/docs/concepts/keyboard",
} satisfies ExampleMeta;
