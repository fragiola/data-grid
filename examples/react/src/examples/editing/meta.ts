import type { ExampleMeta } from "../meta-types";

export default {
    title: "Editing",
    description:
        "Tasks edited in place with a text field, a number, a select and a date: Enter, F2 or typing start an edit, Enter or Tab commit, Escape cancels, and the app writes each value.",
    category: "keyboard",
    order: 5,
    features: [
        "editable",
        "renderEditCell",
        "onCellEdit",
        "data-editing",
        "data-grid-editor",
    ],
    docs: "/docs/concepts/editing",
} satisfies ExampleMeta;
