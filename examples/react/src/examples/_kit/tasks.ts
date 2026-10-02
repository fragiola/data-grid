// Demo data for the tasks board: computed from an index. App content, not part of the data grid.

import { hash } from "./data";

export const PROJECTS = ["Project A", "Project B", "Project C"] as const;
export const STATUSES = ["Completed", "In Progress", "Not Started"] as const;
export const PRIORITIES = ["High", "Medium", "Low"] as const;
export const ASSIGNEES = ["John", "Sara", "Tom"] as const;
export const RATINGS = [1, 2, 3, 4, 5] as const;

export interface Task {
    id: number;
    name: string;
    project: (typeof PROJECTS)[number];
    priority: (typeof PRIORITIES)[number];
    status: (typeof STATUSES)[number];
    assignee: (typeof ASSIGNEES)[number];
    /** ISO date */
    due: string;
    /** 1–5 */
    effectiveness: (typeof RATINGS)[number];
}

const NAMES = [
    "Market Analysis",
    "Product Design",
    "Manufacturing Setup",
    "Quality Assurance",
    "Marketing Strategy",
    "Product Launch",
    "Follow-up Research",
    "Final Report",
    "Project Evaluation",
    "Budgeting",
    "Prototyping",
    "Customer Feedback",
    "Risk Assessment",
    "Production Planning",
    "Supply Chain Setup",
    "Inventory Management",
];

/** The task at `index`. */
export function task(index: number): Task {
    const day = 1 + hash(index + 81, 28);
    const month = 6 + hash(index + 83, 3);
    return {
        id: index + 1,
        // every name once per round, the round after it: unique names
        name: `${NAMES[index % NAMES.length] ?? "Budgeting"}${index >= NAMES.length ? ` ${Math.floor(index / NAMES.length) + 1}` : ""}`,
        project: PROJECTS[hash(index + 87, PROJECTS.length)] ?? "Project A",
        priority: PRIORITIES[hash(index + 89, PRIORITIES.length)] ?? "Medium",
        status: STATUSES[hash(index + 91, STATUSES.length)] ?? "Not Started",
        assignee: ASSIGNEES[hash(index + 93, ASSIGNEES.length)] ?? "Sara",
        due: `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
        effectiveness: RATINGS[hash(index + 95, RATINGS.length)] ?? 3,
    };
}

/** The first `count` tasks. */
export function tasks(count: number): Task[] {
    return Array.from({ length: count }, (_, index) => task(index));
}
