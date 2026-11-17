// Demo data for the styling examples: projects with a status, a score, a change and a tag, all
// computed from an index. App content, not part of the data grid.

import { hash, person } from "./data";

export type Status = "on-track" | "at-risk" | "blocked";

export type Tag = "design" | "platform" | "growth" | "data" | "mobile";

export interface Project {
    id: number;
    name: string;
    owner: string;
    status: Status;
    /** 0–100: how healthy it is (the heatmap column) */
    score: number;
    /** the change since last week, in points (negative is worse) */
    delta: number;
    shipped: boolean;
    tag: Tag;
}

const NAMES = [
    "Atlas",
    "Beacon",
    "Cascade",
    "Delta",
    "Ember",
    "Fjord",
    "Granite",
    "Harbor",
    "Iris",
    "Juniper",
    "Kestrel",
    "Lumen",
];

const STATUSES: Status[] = ["on-track", "on-track", "at-risk", "blocked"];
const TAGS: Tag[] = ["design", "platform", "growth", "data", "mobile"];

export const STATUS_LABELS: Record<Status, string> = {
    "on-track": "On track",
    "at-risk": "At risk",
    blocked: "Blocked",
};

/** The project at `index`. */
export function project(index: number): Project {
    const name = NAMES[hash(index + 21, NAMES.length)] ?? "Atlas";
    return {
        id: index + 1,
        name: `${name} ${1 + hash(index + 23, 9)}.${hash(index + 29, 10)}`,
        owner: person(index).name,
        status: STATUSES[hash(index + 31, STATUSES.length)] ?? "on-track",
        score: hash(index + 37, 101),
        delta: hash(index + 41, 41) - 20,
        shipped: hash(index + 43, 3) === 0,
        tag: TAGS[hash(index + 47, TAGS.length)] ?? "design",
    };
}

/** The first `count` projects. */
export function projects(count: number): Project[] {
    return Array.from({ length: count }, (_, index) => project(index));
}
