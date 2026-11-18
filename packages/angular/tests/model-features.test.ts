import { ChangeDetectionStrategy, Component, signal } from "@angular/core";
import { describe, expect, it } from "vitest";
import { DataGridFiltering, filtering } from "../src/filtering";
import { DataGridLocalRows, injectLocalRows } from "../src/local";
import { DataGridPagination, pagination } from "../src/pagination";
import {
    type Column,
    createDataGridRef,
    DATA_GRID,
    type DataGridNode,
} from "../src/public-api";
import { DataGridSearch, search } from "../src/search";
import { sorting } from "../src/sorting";
import { render, settled, stubViewportSize } from "./helpers";

// Filtering, search and pagination (Epic #153): each one's root directive gives its inputs to the
// root, the model keeps the state; `injectLocalRows` hands the root's model the state of the
// features it runs and takes a command run on it back.

interface Person {
    id: number;
    name: string;
    team: string;
}

const people: Person[] = [
    { id: 1, name: "Carla", team: "Core" },
    { id: 2, name: "Ana", team: "Design" },
    { id: 3, name: "Bruno", team: "Core" },
    { id: 4, name: "Davi", team: "Growth" },
    { id: 5, name: "Élodie", team: "Design" },
];

const columns: Column<Person, DataGridNode>[] = [
    { key: "name", width: 120 },
    { key: "team", width: 120 },
];

const FEATURES = [sorting(), filtering(), search(), pagination()] as const;

stubViewportSize(400, 400);

describe("the root directives of filtering, search and pagination", () => {
    it("give the root their inputs, and tell what a command asks for", async () => {
        const gridRef = createDataGridRef<Person, typeof FEATURES>();
        const told: unknown[] = [];
        @Component({
            imports: [
                DATA_GRID,
                DataGridFiltering,
                DataGridSearch,
                DataGridPagination,
            ],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `
                <div dataGridRoot [features]="features" [columns]="columns" [rows]="rows" [gridRef]="gridRef"
                    dataGridFiltering [columnFilters]="filters()" (columnFiltersChange)="told.push($event)"
                    dataGridSearch [defaultSearchText]="'an'" (searchTextChange)="told.push($event)"
                    dataGridPagination [(pageIndex)]="page" [pageSize]="2" [totalRowCount]="40"></div>
            `,
        })
        class Grid {
            readonly features = FEATURES;
            readonly columns = columns;
            readonly rows = people;
            readonly gridRef = gridRef;
            readonly filters = signal({ team: "Core" });
            readonly page = signal(1);
            readonly told = told;
        }
        const { fixture } = await render(Grid);
        await settled(fixture);
        const model = gridRef.current?.model;
        expect(model?.get("column-filters")).toEqual({ team: "Core" });
        expect(model?.get("search-text")).toBe("an");
        expect(model?.get("page-info")).toEqual({
            pageIndex: 1,
            pageSize: 2,
            pageCount: 20,
            rowCount: 40,
        });
        // controlled: asked, kept
        model?.run("column-filters.clear", undefined);
        expect(told).toEqual([{}]);
        expect(model?.get("column-filters")).toEqual({ team: "Core" });
        // uncontrolled: taken, told
        model?.run("search.clear");
        expect(model?.get("search-text")).toBe("");
        expect(told.at(-1)).toBe("");
        // two-way: the page follows
        model?.run("page.set", { pageIndex: 4 });
        await settled(fixture);
        expect(fixture.componentInstance.page()).toBe(4);
        expect(model?.get("page-info").pageIndex).toBe(4);
    });
});

describe("injectLocalRows over the features", () => {
    it("hands the root's model the state and takes a command run on it back", async () => {
        const gridRef = createDataGridRef<Person, typeof FEATURES>();
        @Component({
            imports: [DATA_GRID, DataGridLocalRows],
            changeDetection: ChangeDetectionStrategy.OnPush,
            template: `<div dataGridRoot [features]="features" [columns]="columns" [gridRef]="gridRef" [dataGridLocalRows]="local"></div>`,
        })
        class Local {
            readonly features = FEATURES;
            readonly columns = columns;
            readonly gridRef = gridRef;
            readonly local = injectLocalRows(people, columns, {
                features: FEATURES,
                pageSize: 2,
                defaultFilters: { team: "Core" },
            });
            // without filtering nor pagination: every row, no prop of theirs
            readonly sortedOnly = injectLocalRows(people, columns, {
                features: [sorting()],
                pageSize: 2,
                defaultFilters: { team: "Core" },
            });
        }
        const { fixture } = await render(Local);
        await settled(fixture);
        const { local, sortedOnly } = fixture.componentInstance;
        expect(sortedOnly.rows).toHaveLength(5);
        expect(Object.keys(sortedOnly.props).sort()).toEqual([
            "onSortColumnsChange",
            "rows",
            "sortColumns",
        ]);
        const model = gridRef.current?.model;
        expect(model?.get("column-filters")).toEqual({ team: "Core" });
        model?.run("column-filters.clear", undefined);
        await settled(fixture);
        expect(local.rows.map((row) => row.name)).toEqual(["Carla", "Ana"]);
        expect(model?.get("page-count")).toBe(3);
        model?.run("page.set", { pageIndex: 2 });
        await settled(fixture);
        expect(local.page.index).toBe(2);
        model?.run("search.set", { text: "an" });
        await settled(fixture);
        expect(local.rows.map((row) => row.name)).toEqual(["Ana"]);
        expect(model?.get("page-info").pageIndex).toBe(0);
    });
});
