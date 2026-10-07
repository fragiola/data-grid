import {
    act,
    fireEvent,
    type RenderResult,
    render,
} from "@testing-library/react";
import { Profiler, type ReactElement } from "react";
import { afterAll, beforeAll } from "vitest";

// What the React tests share: a grid root's size (jsdom lays nothing out), the parts by their
// `data-grid-part` and indexes, and the elements that render a grid as a table.

/** Gives every grid root a `width` × `height` client size during the file's tests. */
export function stubViewportSize(width: number, height: number) {
    beforeAll(() => {
        for (const [property, size] of [
            ["clientWidth", width],
            ["clientHeight", height],
        ] as const) {
            Object.defineProperty(HTMLElement.prototype, property, {
                configurable: true,
                get(this: HTMLElement) {
                    return this.dataset.gridPart === "root" ? size : 0;
                },
            });
        }
    });
    afterAll(() => {
        delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
        delete (HTMLElement.prototype as { clientHeight?: number })
            .clientHeight;
    });
}

/**
 * Renders `ui` counting React's commits (a `Profiler` around it, D9): `commits()` is how many
 * there were since the render or the last `resetCommits()`.
 */
export function renderCounting(ui: ReactElement): RenderResult & {
    commits: () => number;
    resetCommits: () => void;
} {
    let commits = 0;
    const result = render(
        <Profiler
            id="counted"
            onRender={() => {
                commits += 1;
            }}
        >
            {ui}
        </Profiler>,
    );
    return {
        ...result,
        commits: () => commits,
        resetCommits: () => {
            commits = 0;
        },
    };
}

/** Scrolls a grid's root to `top` and `left` (the ones given) and fires its scroll. */
export function scrollRoot(
    element: HTMLElement,
    { top, left }: { top?: number; left?: number },
) {
    if (top !== undefined) element.scrollTop = top;
    if (left !== undefined) element.scrollLeft = left;
    fireEvent.scroll(element);
}

/** DOM changes reach the engine's observer as a microtask: let it run. */
export const settled = () =>
    act(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));

function find(container: ParentNode, selector: string): HTMLElement {
    const element = container.querySelector(selector);
    if (!(element instanceof HTMLElement)) throw new Error(`no ${selector}`);
    return element;
}

/** The grid's root. */
export const root = (container: ParentNode) =>
    find(container, '[data-grid-part="root"]');

/** The body row at `rowIndex`. */
export const rowAt = (container: ParentNode, rowIndex: number) =>
    find(container, `[data-grid-part="row"][data-row-index="${rowIndex}"]`);

/** The cell at `rowIndex` and `columnIndex`: a header cell above row 0. */
export const cellAt = (
    container: ParentNode,
    rowIndex: number,
    columnIndex = 0,
) =>
    find(
        container,
        `[data-grid-part="${rowIndex < 0 ? "header-cell" : "cell"}"][data-row-index="${rowIndex}"][data-column-index="${columnIndex}"]`,
    );

/** The first header cell of the column at `columnIndex`. */
export const headerAt = (container: ParentNode, columnIndex: number) =>
    find(
        container,
        `[data-grid-part="header-cell"][data-column-index="${columnIndex}"]`,
    );

const TABLE = {
    grid: <table />,
    header: <thead />,
    headerRow: <tr />,
    headerCell: <th />,
    body: <tbody />,
    row: <tr />,
    cell: <td />,
};

/** The `render` element of each part: a table's, or none (the parts' own divs). */
export const tags = (table: boolean): Partial<typeof TABLE> =>
    table ? TABLE : {};
