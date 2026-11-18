// A pretend backend for people (the server-side example, Epic #153): it holds ten thousand people
// and answers a query made of the grid's state (the sort, the column filters, the search text and
// the page) after a delay. A real one would run SQL; this one sorts, filters and pages its own
// array. App code, copyable: swap `fetchPeople` for a `fetch` to your API.

import { type Person, people } from "./data";
import { createFakeApi } from "./fake-api";

export const peopleApi = createFakeApi(350);

const everyone = people(10_000);

/** What the app asks for: the grid's sort, filters, search and page, as its features hold them. */
export interface PeopleQuery {
    readonly sortColumns: readonly {
        readonly columnKey: string;
        readonly direction: "ascending" | "descending";
    }[];
    /** by column key: a list holds the value, a text is contained, anything else equals */
    readonly columnFilters: Readonly<Record<string, unknown>>;
    readonly searchText: string;
    readonly pageIndex: number;
    readonly pageSize: number;
}

/** A page of people, and how many match the query on every page. */
export interface PeoplePage {
    readonly rows: readonly Person[];
    readonly total: number;
}

type Field = Exclude<keyof Person, "id">;

const FIELDS: readonly Field[] = [
    "name",
    "email",
    "city",
    "team",
    "salary",
    "joined",
];

const collator = new Intl.Collator(undefined, {
    numeric: true,
    sensitivity: "base",
});

const fold = (text: string) =>
    text
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();

/** Whether a person's field passes a filter value. */
function passes(value: unknown, filter: unknown): boolean {
    if (Array.isArray(filter)) return filter.includes(value);
    if (typeof filter === "string") {
        return fold(String(value)).includes(fold(filter));
    }
    return value === filter;
}

function describe(query: PeopleQuery): string {
    const sort = query.sortColumns
        .map(
            ({ columnKey, direction }) =>
                `${columnKey} ${direction === "ascending" ? "↑" : "↓"}`,
        )
        .join(", ");
    const filters = Object.entries(query.columnFilters).map(
        ([key, value]) =>
            `${key} ${Array.isArray(value) ? value.join(" or ") : String(value)}`,
    );
    return [
        `page ${query.pageIndex + 1}`,
        sort && `sorted by ${sort}`,
        ...filters,
        query.searchText && `“${query.searchText}”`,
    ]
        .filter(Boolean)
        .join(" · ");
}

/** Asks the server for a page of people. */
export function fetchPeople(query: PeopleQuery): Promise<PeoplePage> {
    return peopleApi.fetchQuery<Person>(describe(query), () => {
        const wanted = fold(query.searchText.trim());
        const filters = Object.entries(query.columnFilters).filter(
            (entry): entry is [Field, unknown] =>
                FIELDS.includes(entry[0] as Field),
        );
        const matching = everyone.filter(
            (row) =>
                filters.every(([key, filter]) => passes(row[key], filter)) &&
                (wanted === "" ||
                    FIELDS.some((key) =>
                        fold(String(row[key])).includes(wanted),
                    )),
        );
        const sorts = query.sortColumns.filter((sort) =>
            FIELDS.includes(sort.columnKey as Field),
        );
        const sorted = [...matching].sort((a, b) => {
            for (const { columnKey, direction } of sorts) {
                const x = a[columnKey as Field];
                const y = b[columnKey as Field];
                const order =
                    typeof x === "number" && typeof y === "number"
                        ? x - y
                        : collator.compare(String(x), String(y));
                if (order !== 0)
                    return direction === "ascending" ? order : -order;
            }
            return 0;
        });
        const start = query.pageIndex * query.pageSize;
        return {
            rows: sorted.slice(start, start + query.pageSize),
            total: sorted.length,
        };
    });
}
