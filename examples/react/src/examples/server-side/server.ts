import type { SortColumn } from "@fragiola/data-grid";
import {
    filterRows,
    pageRows,
    searchRows,
    sortRows,
} from "@fragiola/data-grid/local";
import { type Person, people } from "../_kit/data";
import { createFakeApi } from "../_kit/fake-api";

// The pretend backend: it holds ten thousand people and answers a query (sorted, filtered, paged)
// after a delay. A real one would run SQL; this one runs the local pipeline's functions on its
// own data. The app never holds more than a page.

export const api = createFakeApi(350);

const everyone = people(10_000);

/** What the app asks for. */
export interface Query {
    readonly sortColumns: readonly SortColumn[];
    readonly team: string;
    readonly search: string;
    readonly pageIndex: number;
    readonly pageSize: number;
}

/** The columns the server sorts, filters and searches by (its schema). */
const schema = [
    { key: "name", width: 0 },
    { key: "email", width: 0 },
    { key: "city", width: 0 },
    { key: "team", width: 0 },
    { key: "salary", width: 0 },
];

function describe(query: Query): string {
    const sort = query.sortColumns
        .map(
            ({ columnKey, direction }) =>
                `${columnKey} ${direction === "ascending" ? "↑" : "↓"}`,
        )
        .join(", ");
    return [
        `page ${query.pageIndex + 1}`,
        sort && `sorted by ${sort}`,
        query.team && `team ${query.team}`,
        query.search && `“${query.search}”`,
    ]
        .filter(Boolean)
        .join(" · ");
}

/** Asks the server for a page of people. */
export function fetchPeople(query: Query) {
    return api.fetchQuery<Person>(describe(query), () => {
        const matching = sortRows(
            searchRows(
                // a team chosen from a list: an exact value (a list filter), not a text contained
                filterRows(
                    everyone,
                    { team: query.team ? [query.team] : [] },
                    schema,
                ),
                query.search,
                schema,
            ),
            query.sortColumns,
            schema,
        );
        return {
            rows: pageRows(matching, query.pageIndex, query.pageSize),
            total: matching.length,
        };
    });
}
