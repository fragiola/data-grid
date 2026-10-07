import { act, fireEvent } from "@testing-library/react";
import type { ReactElement } from "react";
import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cellAt, root, stubViewportSize } from "./helpers";
import { SERVER_GRIDS } from "./server-grids";

// Hydration (Epic #89, E5.1): the server's HTML (`server.test.tsx`) hydrated in jsdom matches the
// client's first render (the grid before its viewport attaches renders the same view on both
// sides), so React recovers from nothing and logs nothing; then the viewport attaches, the window
// of rows and columns renders, and the grid works: a cell takes focus and the keys.

stubViewportSize(400, 200);

let hydrated: { container: HTMLElement; root: Root } | null = null;

/** Unmounts the grid hydrated last and removes its container from the page. */
function release() {
    if (!hydrated) return;
    const { container, root } = hydrated;
    act(() => root.unmount());
    container.remove();
    hydrated = null;
}

afterEach(() => {
    release();
    vi.restoreAllMocks();
});

/** Hydrates the server's HTML of a grid; returns its container, failing on any recovery or log. */
async function hydrate(grid: ReactElement): Promise<HTMLElement> {
    const container = document.createElement("div");
    container.innerHTML = renderToString(grid);
    document.body.append(container);
    const logged = [vi.spyOn(console, "error"), vi.spyOn(console, "warn")];
    const recovered: unknown[] = [];
    let root: Root | undefined;
    await act(async () => {
        root = hydrateRoot(container, grid, {
            onRecoverableError: (error) => recovered.push(error),
        });
    });
    if (root) hydrated = { container, root };
    expect(recovered).toEqual([]);
    for (const spy of logged) expect(spy).not.toHaveBeenCalled();
    return container;
}

describe("hydration", () => {
    for (const [name, grid] of Object.entries(SERVER_GRIDS)) {
        for (const table of [false, true]) {
            it(`hydrates ${name} as ${table ? "a table" : "divs"}, then renders its window`, async () => {
                const container = await hydrate(grid(table));
                const cells = container.querySelectorAll(
                    '[data-grid-part="cell"]',
                );
                if (name === "an empty grid") {
                    expect(cells).toHaveLength(0);
                    expect(root(container)).toHaveAttribute("data-empty", "");
                } else {
                    // the window, from the viewport's size: rows and columns
                    expect(cells.length).toBeGreaterThan(4);
                    expect(
                        container.querySelectorAll(
                            '[data-grid-part="header-cell"]',
                        ).length,
                    ).toBeGreaterThan(0);
                }
            });
        }
    }

    it("works once hydrated: a cell takes focus and the keys move it", async () => {
        const container = await hydrate(SERVER_GRIDS.rows(true));
        const start = cellAt(container, 1, 1);
        act(() => start.focus());
        expect(start).toHaveAttribute("data-active", "");
        expect(document.activeElement).toBe(start);
        fireEvent.keyDown(start, { key: "ArrowDown" });
        const next = cellAt(container, 2, 1);
        expect(next).toHaveAttribute("data-active", "");
        expect(document.activeElement).toBe(next);
    });

    it("keeps the state given on the server: a direction, a range, the active cell", async () => {
        const rtl = await hydrate(SERVER_GRIDS["right to left"](false));
        expect(root(rtl)).toHaveAttribute("dir", "rtl");
        release();

        const container = await hydrate(SERVER_GRIDS["cell selection"](false));
        expect(cellAt(container, 1, 1)).toHaveAttribute("data-active", "");
        expect(cellAt(container, 2, 2)).toHaveAttribute(
            "data-selected-cell",
            "",
        );
        fireEvent.keyDown(cellAt(container, 1, 1), {
            key: "ArrowRight",
            shiftKey: true,
        });
        expect(cellAt(container, 1, 3)).toHaveAttribute(
            "data-selected-cell",
            "",
        );
    });
});
