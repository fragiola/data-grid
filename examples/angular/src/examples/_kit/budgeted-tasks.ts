// Demo data and rules for the editing examples: tasks with a budget, and how a value a person
// typed, pasted or filled becomes a field of one. App content, not part of the data grid.

import { hash } from "./data";
import { STATUSES, type Task, tasks } from "./tasks";

export interface BudgetedTask extends Task {
    /** in dollars */
    budget: number;
}

/** The first `count` tasks, each with a budget. */
export function budgetedTasks(count: number): BudgetedTask[] {
    return tasks(count).map((task, index) => ({
        ...task,
        budget: 100 * (5 + hash(index + 7, 200)),
    }));
}

export function isStatus(value: unknown): value is Task["status"] {
    return STATUSES.some((status) => status === value);
}

/** A value as a budget: a whole number of dollars, 0 or more ($ and commas dropped), or none. */
export function amountOf(value: unknown): number | undefined {
    const text = String(value ?? "").replace(/[$,\s]/g, "");
    const amount = Number(text);
    return text !== "" && Number.isFinite(amount) && amount >= 0
        ? Math.round(amount)
        : undefined;
}

/**
 * A task with a field changed by the app's rules, from what a person typed, pasted or filled;
 * `undefined` when the value is refused (not a name, an amount, a status or a date) or the field
 * is not one a person changes.
 */
export function withField(
    task: BudgetedTask,
    columnKey: string,
    value: unknown,
): BudgetedTask | undefined {
    if (columnKey === "name" && typeof value === "string" && value.trim()) {
        return { ...task, name: value.trim() };
    }
    if (columnKey === "budget") {
        if (task.status === "Completed") return undefined;
        const budget = amountOf(value);
        return budget === undefined ? undefined : { ...task, budget };
    }
    if (columnKey === "status" && isStatus(value)) {
        return { ...task, status: value };
    }
    if (
        columnKey === "due" &&
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value)
    ) {
        return { ...task, due: value };
    }
    return undefined;
}
