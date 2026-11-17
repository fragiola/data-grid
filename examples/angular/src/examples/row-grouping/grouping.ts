import type { Person } from "../_kit/data";

/** The groupings the toolbar offers, and the columns each one groups by, the outer one first. */
export const GROUPINGS = {
    team: "By team",
    "team-city": "By team, then city",
} as const;

export type Grouping = keyof typeof GROUPINGS;

export const GROUP_BY: Record<Grouping, readonly string[]> = {
    team: ["team"],
    "team-city": ["team", "city"],
};

/** What a group row shows in these columns: the app's figures over the group's rows. */
export const AGGREGATES = {
    salary: (rows: readonly Person[]) =>
        rows.reduce((sum, person) => sum + person.salary, 0),
    joined: (rows: readonly Person[]) => {
        const years = rows.map((person) => person.joined.slice(0, 4)).sort();
        return `${years[0]}–${years[years.length - 1]}`;
    },
};
