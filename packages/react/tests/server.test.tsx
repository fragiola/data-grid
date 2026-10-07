// @vitest-environment node
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SERVER_GRIDS } from "./server-grids";

// Server rendering (Epic #89, E5.1), in plain Node: no `window`, no `document`. A grid renders to
// a string without a warning (React's, or a layout effect's), with no DOM to measure: the
// structure, its ARIA and its structural styles, while the rows and cells wait for the viewport's
// size on the client (`hydration.test.tsx`).

afterEach(() => {
    vi.restoreAllMocks();
});

/** The server's HTML for a grid, failing on any warning or error React or the grid logs. */
function serverHtml(grid: Parameters<typeof renderToString>[0]): string {
    const logged = [
        vi.spyOn(console, "error"),
        vi.spyOn(console, "warn"),
        vi.spyOn(console, "log"),
    ];
    const html = renderToString(grid);
    for (const spy of logged) expect(spy).not.toHaveBeenCalled();
    return html;
}

describe("server rendering", () => {
    it("runs where there is no DOM", () => {
        expect(typeof window).toBe("undefined");
        expect(typeof document).toBe("undefined");
    });

    for (const [name, grid] of Object.entries(SERVER_GRIDS)) {
        for (const table of [false, true]) {
            it(`renders ${name} as ${table ? "a table" : "divs"}, warning nothing`, () => {
                const html = serverHtml(grid(table));
                expect(html).toContain('data-grid-part="root"');
                expect(html).toMatch(/role="(tree)?grid"/);
                expect(html).toContain('aria-label="Sales"');
                expect(html.includes("<table")).toBe(table);
            });
        }
    }

    it("renders what the grid knows without a DOM: counts, kinds, direction, emptiness", () => {
        const rows = serverHtml(SERVER_GRIDS.rows(false));
        // 40 rows and the header row, 4 columns
        expect(rows).toContain('aria-rowcount="41"');
        expect(rows).toContain('aria-colcount="4"');
        // the root is no tab stop, the grid is (no cell is active yet)
        expect(rows).toMatch(/data-grid-part="root"[^>]*tabindex="-1"/);
        expect(rows).toMatch(/role="grid"[^>]*tabindex="0"/);
        // nothing is measured on the server: no row nor cell before the viewport has a size
        expect(rows).not.toContain('data-grid-part="row"');
        expect(rows).not.toContain('data-grid-part="cell"');

        // two header rows under the group
        expect(serverHtml(SERVER_GRIDS["column groups"](false))).toContain(
            'aria-rowcount="42"',
        );
        // rows with kinds: a treegrid
        expect(serverHtml(SERVER_GRIDS["row groups"](false))).toContain(
            'role="treegrid"',
        );
        expect(serverHtml(SERVER_GRIDS["tree data"](false))).toContain(
            'role="treegrid"',
        );
        // the summary rows count among the rows
        expect(serverHtml(SERVER_GRIDS["summary rows"](false))).toContain(
            'aria-rowcount="43"',
        );
        // a direction given is rendered on the root, on the server too
        expect(serverHtml(SERVER_GRIDS["right to left"](false))).toMatch(
            /data-grid-part="root"[^>]*dir="rtl"/,
        );
        expect(rows).not.toContain("dir=");
        // ranges of cells: a multiselectable grid; the active cell takes the tab stop
        const cells = serverHtml(SERVER_GRIDS["cell selection"](false));
        expect(cells).toContain('aria-multiselectable="true"');
        expect(cells).toMatch(/role="grid"[^>]*tabindex="-1"/);
        // no rows: the empty state renders, the root and the grid marked
        const empty = serverHtml(SERVER_GRIDS["an empty grid"](false));
        expect(empty).toContain("No sales");
        expect(empty).toMatch(/data-grid-part="root"[^>]*data-empty=""/);
        expect(empty).toMatch(/data-grid-part="empty"/);
        expect(rows).not.toContain("No sales");
    });
});
