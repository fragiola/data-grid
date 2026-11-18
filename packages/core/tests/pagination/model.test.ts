import { describe, expect, it, vi } from "vitest";
import { bindGridRoot, createDataGridModel } from "../../src";
import { pageCount, pagination } from "../../src/pagination";

// Pagination (Epic #153): installed, the model keeps the page and its size, and counts the pages
// from the rows across every page (`totalRowCount`, else the grid's own row count); a root's
// props control them. The grid never pages the rows.

const columns = [{ key: "n", width: 80 }];
const rows = Array.from({ length: 23 }, (_, n) => ({ n }));

function paged(options: { pageSize?: number; pageIndex?: number } = {}) {
    return createDataGridModel({
        columns,
        rows,
        features: [pagination()],
        ...options,
    });
}

describe("pagination", () => {
    it("counts pages: one at least, one in all without a page size", () => {
        expect(pageCount(0, 10)).toBe(1);
        expect(pageCount(23, 10)).toBe(3);
        expect(pageCount(23, undefined)).toBe(1);
    });

    it("starts on the first page without a size, or as given", () => {
        expect(paged().get("page-info")).toEqual({
            pageIndex: 0,
            pageSize: undefined,
            pageCount: 1,
            rowCount: 23,
        });
        const grid = paged({ pageSize: 10, pageIndex: 2 });
        expect(grid.get("page-count")).toBe(3);
        expect(grid.is("page-previous", undefined)).toBe(true);
        expect(grid.is("page-next", undefined)).toBe(false);
        // anything else than a whole size above 0 is none, a whole index 0 or more the first
        expect(
            paged({ pageSize: 0, pageIndex: -1 }).get("page-info"),
        ).toMatchObject({ pageIndex: 0, pageSize: undefined });
    });

    it("sets the page, its size and the total, refusing what is not one", () => {
        const grid = paged({ pageSize: 10 });
        expect(grid.run("page.set", { pageIndex: 1 })).toEqual({
            ok: true,
            value: 1,
        });
        // a page past the last is kept: the app (a server's total, not known yet) clamps it
        expect(grid.run("page.set", { pageIndex: 9 })).toEqual({
            ok: true,
            value: 9,
        });
        expect(grid.run("page.set", { pageIndex: 1.5 })).toMatchObject({
            ok: false,
            error: { code: "invalid_payload" },
        });
        expect(grid.run("page-size.set", { pageSize: 5 })).toEqual({
            ok: true,
            value: 5,
        });
        // the page stays where it was: the first-page rules are the app's
        expect(grid.get("page-info").pageIndex).toBe(9);
        expect(grid.get("page-count")).toBe(5);
        expect(grid.run("page-size.set", { pageSize: 0 })).toMatchObject({
            ok: false,
        });
        grid.run("total-row-count.set", { totalRowCount: 1000 });
        expect(grid.get("page-count")).toBe(200);
        grid.run("total-row-count.set", { totalRowCount: undefined });
        expect(grid.get("page-count")).toBe(5);
        grid.run("page-size.set", { pageSize: undefined });
        expect(grid.get("page-count")).toBe(1);
        expect(grid.state.rowCount).toBe(23);
    });

    it("is controlled by a root's props, the total followed", () => {
        const onPageIndexChange = vi.fn();
        const onPageSizeChange = vi.fn();
        let props = {
            columns,
            rows,
            features: [pagination()] as const,
            pageIndex: 0,
            onPageIndexChange,
            pageSize: 10 as number | null,
            onPageSizeChange,
            totalRowCount: 95 as number | undefined,
        };
        const root = bindGridRoot(() => props);
        root.sync();
        expect(root.model.get("page-count")).toBe(10);
        root.model.run("page.set", { pageIndex: 3 });
        expect(onPageIndexChange).toHaveBeenCalledWith(3);
        expect(root.model.get("page-info").pageIndex).toBe(0);
        root.model.run("page-size.set", { pageSize: undefined });
        expect(onPageSizeChange).toHaveBeenCalledWith(undefined);
        expect(root.model.get("page-info").pageSize).toBe(10);
        props = {
            ...props,
            pageIndex: 3,
            pageSize: null,
            totalRowCount: undefined,
        };
        root.sync();
        expect(root.model.get("page-info")).toEqual({
            pageIndex: 3,
            pageSize: undefined,
            pageCount: 1,
            rowCount: 23,
        });
    });
});
