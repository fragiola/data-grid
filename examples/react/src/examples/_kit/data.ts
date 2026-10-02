// Demo data, computed from an index: the same row every time, and nothing stored, so a grid can
// show a million of them for free. App content, not part of the data grid.

const FIRST = [
    "Ada",
    "Grace",
    "Alan",
    "Linus",
    "Margaret",
    "Dennis",
    "Barbara",
    "Ken",
    "Frances",
    "Edsger",
    "Radia",
    "Guido",
    "Hedy",
    "Tim",
    "Katherine",
    "Donald",
];

const LAST = [
    "Lovelace",
    "Hopper",
    "Turing",
    "Torvalds",
    "Hamilton",
    "Ritchie",
    "Liskov",
    "Thompson",
    "Allen",
    "Dijkstra",
    "Perlman",
    "van Rossum",
    "Lamarr",
    "Berners-Lee",
    "Johnson",
    "Knuth",
];

const CITIES = [
    "Lisbon",
    "São Paulo",
    "Toronto",
    "Nairobi",
    "Osaka",
    "Berlin",
    "Austin",
    "Melbourne",
    "Bogotá",
    "Oslo",
    "Seoul",
    "Dublin",
];

const TEAMS = ["Platform", "Design", "Data", "Mobile", "Growth", "Security"];

/** A deterministic integer in [0, max) from a seed: the same seed, the same number. */
export function hash(seed: number, max: number): number {
    let x = Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b);
    x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35);
    x ^= x >>> 16;
    return (x >>> 0) % max;
}

export interface Person {
    id: number;
    name: string;
    email: string;
    city: string;
    team: string;
    salary: number;
    joined: string;
}

/** The person at `index`. */
export function person(index: number): Person {
    const first = FIRST[hash(index, FIRST.length)] ?? "Ada";
    const last = LAST[hash(index + 7, LAST.length)] ?? "Lovelace";
    const year = 2010 + hash(index + 3, 16);
    const month = 1 + hash(index + 5, 12);
    return {
        id: index + 1,
        name: `${first} ${last}`,
        email: `${first}.${last}${index + 1}@example.com`
            .toLowerCase()
            .replace(/\s+/g, ""),
        city: CITIES[hash(index + 11, CITIES.length)] ?? "Lisbon",
        team: TEAMS[hash(index + 13, TEAMS.length)] ?? "Platform",
        salary: 40_000 + hash(index + 17, 120) * 1_000,
        joined: `${year}-${String(month).padStart(2, "0")}`,
    };
}

/** The first `count` people. */
export function people(count: number): Person[] {
    return Array.from({ length: count }, (_, index) => person(index));
}

/** A number for a cell of a large numeric grid, from its row and column. */
export function measurement(rowIndex: number, columnIndex: number): number {
    return hash(rowIndex * 7_919 + columnIndex * 104_729, 100_000) / 100;
}

/** `1234567` → `1,234,567`. */
export function formatNumber(value: number): string {
    return value.toLocaleString("en-US");
}

/** `52000` → `$52,000`. */
export function formatMoney(value: number): string {
    return `$${value.toLocaleString("en-US")}`;
}
