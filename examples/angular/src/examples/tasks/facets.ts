import {
    ASSIGNEES,
    PRIORITIES,
    PROJECTS,
    RATINGS,
    STATUSES,
    type Task,
} from "../_kit/tasks";

// Faceted filtering, the app's own: a facet keeps a row when nothing is checked in it or when the
// row's value is checked (OR within a facet); a row passes when every facet keeps it (AND across).

export type FacetKey =
    | "project"
    | "status"
    | "priority"
    | "assignee"
    | "effectiveness";

export interface Facet {
    key: FacetKey;
    title: string;
    values: readonly string[];
}

export const FACETS: readonly Facet[] = [
    { key: "project", title: "Project", values: PROJECTS },
    { key: "status", title: "Status", values: STATUSES },
    { key: "priority", title: "Priority", values: PRIORITIES },
    { key: "assignee", title: "Assigned to", values: ASSIGNEES },
    {
        key: "effectiveness",
        title: "Effectiveness",
        values: RATINGS.map(String),
    },
];

export type Checked = Readonly<Record<FacetKey, ReadonlySet<string>>>;

export const NONE: Checked = {
    project: new Set(),
    status: new Set(),
    priority: new Set(),
    assignee: new Set(),
    effectiveness: new Set(),
};

function facetValue(task: Task, key: FacetKey): string {
    return String(task[key]);
}

/** Whether a task passes every facet but `except`. */
function passes(task: Task, checked: Checked, except?: FacetKey): boolean {
    return FACETS.every(
        ({ key }) =>
            key === except ||
            checked[key].size === 0 ||
            checked[key].has(facetValue(task, key)),
    );
}

export function filter(tasks: readonly Task[], checked: Checked): Task[] {
    return tasks.filter((task) => passes(task, checked));
}

/**
 * How many tasks a value of a facet would show: the tasks passing every other facet with this
 * value (so checking it never shows a count it cannot deliver).
 */
export function counts(
    tasks: readonly Task[],
    checked: Checked,
): Record<FacetKey, Map<string, number>> {
    const result = {} as Record<FacetKey, Map<string, number>>;
    for (const { key, values } of FACETS) {
        const map = new Map(values.map((value) => [value, 0]));
        for (const task of tasks) {
            if (!passes(task, checked, key)) continue;
            const value = facetValue(task, key);
            map.set(value, (map.get(value) ?? 0) + 1);
        }
        result[key] = map;
    }
    return result;
}

/** `checked` with `value` of `key` toggled. */
export function toggle(
    checked: Checked,
    key: FacetKey,
    value: string,
): Checked {
    const next = new Set(checked[key]);
    if (!next.delete(value)) next.add(value);
    return { ...checked, [key]: next };
}
