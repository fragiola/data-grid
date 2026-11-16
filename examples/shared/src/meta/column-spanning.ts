import type { ExampleMeta } from "../meta-types";

export default {
    title: "Column spanning",
    description:
        "A day of room bookings: each booking spans the hours it takes, the header groups the hours two by two, and the arrows step over a booking in one move.",
    category: "columns",
    order: 5,
    features: ["colSpan", "aria-colspan", "pinned", "keyboard"],
    docs: "/docs/concepts/column-spanning",
} satisfies ExampleMeta;
