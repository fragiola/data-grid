import type { ExampleMeta } from "../meta-types";

export default {
    title: "Interactive cells",
    description:
        "Fields, a select, links and buttons in cells, and the grid still one tab stop: Enter or F2 reach a cell's controls, Tab cycles them, Escape comes back.",
    category: "keyboard",
    order: 3,
    features: [
        "Enter / F2",
        "Escape",
        "data-interacting",
        "data-grid-tab-stop",
        "one tab stop",
    ],
    docs: "/docs/concepts/keyboard",
} satisfies ExampleMeta;
