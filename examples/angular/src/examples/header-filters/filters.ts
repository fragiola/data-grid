import { ASSIGNEES, PRIORITIES, PROJECTS, STATUSES } from "../_kit/tasks";

/** A select filter's choice: its value and its label. */
export interface Choice {
    readonly value: string;
    readonly label: string;
}

/**
 * A select filter's choices, in order: every value, then each one. An array, not an object: an
 * object lists keys like "3" before "all".
 */
function choices(values: readonly string[]): Choice[] {
    return [
        { value: "all", label: "All" },
        ...values.map((value) => ({ value, label: value })),
    ];
}

/** The filter under each column's name, by key: a text field or a select. */
export const FILTERS: Partial<
    Record<string, { kind: "text" } | { kind: "select"; items: Choice[] }>
> = {
    name: { kind: "text" },
    project: { kind: "select", items: choices(PROJECTS) },
    priority: { kind: "select", items: choices(PRIORITIES) },
    status: { kind: "select", items: choices(STATUSES) },
    assignee: { kind: "select", items: choices(ASSIGNEES) },
    effectiveness: {
        kind: "select",
        items: [
            { value: "all", label: "Any" },
            { value: "3", label: "3 and up" },
            { value: "4", label: "4 and up" },
            { value: "5", label: "5" },
        ],
    },
};
