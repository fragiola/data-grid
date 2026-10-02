// Demo data for the companies CRM: computed from an index, nothing fetched (the logos are
// initials). App content, not part of the data grid.

import { hash } from "./data";

export const CATEGORIES = [
    "Automation",
    "B2B",
    "B2C",
    "Consulting",
    "E-commerce",
    "Enterprise",
    "Finance",
    "Human Resources",
    "Information Technology",
    "Insurance",
    "Marketplace",
    "Publishing",
    "SaaS",
    "Venture Capital",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const EMPLOYEE_RANGES = [
    "0–10",
    "11–50",
    "51–250",
    "251–1K",
    "1K–5K",
] as const;

export type EmployeeRange = (typeof EMPLOYEE_RANGES)[number];

export const ARR_RANGES = [
    "$1M–$10M",
    "$10M–$50M",
    "$50M–$100M",
    "$1B+",
] as const;

export type ArrRange = (typeof ARR_RANGES)[number];

export const COUNTRIES = [
    "United States of America",
    "United Kingdom",
    "France",
    "Germany",
    "Brazil",
    "Canada",
] as const;

export interface Company {
    id: number;
    name: string;
    domain: string;
    categories: Category[];
    description: string;
    linkedin: string;
    employees: EmployeeRange;
    /** `null` when not estimated */
    arr: ArrRange | null;
    country: (typeof COUNTRIES)[number];
}

const PREFIXES = [
    "Alt",
    "Api",
    "Beam",
    "Candi",
    "Capture",
    "Defacto",
    "Incentive",
    "Moon",
    "Gov",
    "Palan",
    "Patch",
    "Poke",
    "Pugh",
    "Remus",
    "Safe",
    "Serio",
];

const SUFFIXES = [
    "Legal",
    "Deck",
    "ery",
    "Labs",
    "Ltd",
    "Games",
    "fire",
    "Works",
    "Plants",
    "AI",
    "Capital",
    "Software",
];

const BLURBS = [
    "provides legal technology for growing teams",
    "redefines API integration and management",
    "is a leading talent acquisition platform",
    "shows the people behind your sales leads",
    "is a provider of financial technology",
    "offers instant financial services and marketplaces",
    "is a platform for engaging games",
    "is an early stage venture capital firm",
    "builds software that helps organisations decide",
    "makes it easy to buy and care for plants",
];

/** The company at `index`. */
export function company(index: number): Company {
    const name = `${PREFIXES[hash(index + 51, PREFIXES.length)] ?? "Alt"}${SUFFIXES[hash(index + 53, SUFFIXES.length)] ?? "Labs"}${index > 15 ? ` ${1 + (index % 97)}` : ""}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const count = 2 + hash(index + 57, 4);
    const categories = [
        ...new Set(
            Array.from(
                { length: count },
                (_, i) =>
                    CATEGORIES[hash(index * 7 + i + 59, CATEGORIES.length)] ??
                    "B2B",
            ),
        ),
    ].sort();
    const arrIndex = hash(index + 61, ARR_RANGES.length + 1);
    return {
        id: index + 1,
        name,
        domain: `${slug}.${["com", "io", "co.uk", "ai"][hash(index + 63, 4)] ?? "com"}`,
        categories,
        description: `${name} ${BLURBS[hash(index + 67, BLURBS.length)] ?? BLURBS[0]}.`,
        linkedin: slug,
        employees:
            EMPLOYEE_RANGES[hash(index + 71, EMPLOYEE_RANGES.length)] ??
            "11–50",
        arr: ARR_RANGES[arrIndex] ?? null,
        country: COUNTRIES[hash(index + 73, COUNTRIES.length)] ?? "France",
    };
}

/** The first `count` companies. */
export function companies(count: number): Company[] {
    return Array.from({ length: count }, (_, index) => company(index));
}

/** "Alt Legal" → "AL". */
export function initials(name: string): string {
    const letters = name.match(/[A-Z]/g) ?? [name.charAt(0)];
    return letters.slice(0, 2).join("").toUpperCase();
}
