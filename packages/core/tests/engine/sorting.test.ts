// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type ColumnOrGroup,
    createDataGridEngine,
    createDataGridModel,
    headerCellSort,
} from "../../src";

// Sorting from the header (Epic #27, S3–S6): a click, Enter or Space on a sortable column's
// header cell toggles the sort, Ctrl/⌘ adds the column; a consumer's preventDefault, a control
// inside the cell, a drag and a double click's second click do not sort.

interface Row {
    id: number;
}

class FakeResizeObserver {
    observe() {}
    disconnect() {}
}

afterEach(() => {
    document.body.innerHTML = "";
});

// "id" spans both header rows; "who" groups the sortable "name" and the unsortable "note"
const COLUMNS: ColumnOrGroup<Row>[] = [
    { key: "id", width: 80, sortable: true },
    {
        key: "who",
        children: [
            { key: "name", width: 120, sortable: true },
            { key: "note", width: 120 },
        ],
    },
];

function setup() {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const model = createDataGridModel<Row>({
        columns: COLUMNS,
        rowCount: 100,
        getRow: (id) => ({ id }),
        rowHeight: 20,
        headerRowHeight: 30,
    });
    const engine = createDataGridEngine(model);
    const view = () => engine.adapter.getView();
    const viewport = document.createElement("div");
    Object.defineProperties(viewport, {
        clientWidth: { get: () => 400 },
        clientHeight: { get: () => 260 },
    });
    const grid = document.createElement("div");
    viewport.append(grid);
    document.body.append(viewport);
    engine.adapter.attach(viewport);
    engine.adapter.registerLayer("grid", grid);
    engine.adapter.commit(view());
    /** a header cell's element, as an adapter renders it: at its top row and first column */
    const headerCell = (rowIndex: number, columnIndex: number) => {
        const element = document.createElement("div");
        element.dataset.rowIndex = String(rowIndex);
        element.dataset.columnIndex = String(columnIndex);
        element.tabIndex = -1;
        grid.append(element);
        return element;
    };
    /** a press and its click, as a browser sends them; `moved` pixels between the two */
    const click = (
        target: Element,
        init: MouseEventInit = {},
        moved = 0,
    ): { handled: boolean; event: MouseEvent } => {
        target.dispatchEvent(
            new MouseEvent("pointerdown", {
                bubbles: true,
                clientX: 10,
                clientY: 10,
            }),
        );
        const event = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            button: 0,
            detail: 1,
            clientX: 10 + moved,
            clientY: 10,
            ...init,
        });
        Object.defineProperty(event, "target", { value: target });
        return { handled: engine.adapter.click(event), event };
    };
    const key = (
        target: Element,
        name: string,
        init: KeyboardEventInit = {},
    ) => {
        const event = new KeyboardEvent("keydown", {
            key: name,
            cancelable: true,
            ...init,
        });
        Object.defineProperty(event, "target", { value: target });
        const handled = engine.adapter.keydown(event);
        return { handled, event };
    };
    const sort = () =>
        model.state.sortColumns.map(
            (entry) => `${entry.columnKey} ${entry.direction}`,
        );
    return { model, engine, view, headerCell, click, key, sort };
}

describe("a click on a header cell", () => {
    it("toggles a sortable column: ascending, descending, not sorted", () => {
        const { headerCell, click, sort } = setup();
        const id = headerCell(-2, 0);
        expect(click(id).handled).toBe(true);
        expect(sort()).toEqual(["id ascending"]);
        click(id);
        expect(sort()).toEqual(["id descending"]);
        click(id);
        expect(sort()).toEqual([]);
    });

    it("adds a column with Ctrl or ⌘, and replaces the sort without", () => {
        const { headerCell, click, sort } = setup();
        const id = headerCell(-2, 0);
        const name = headerCell(-1, 1);
        click(id);
        click(name, { ctrlKey: true });
        expect(sort()).toEqual(["id ascending", "name ascending"]);
        click(name, { metaKey: true });
        expect(sort()).toEqual(["id ascending", "name descending"]);
        // alone, "name" goes on from where it was (descending: the end of its cycle), and only it
        click(id);
        expect(sort()).toEqual(["id descending"]);
        click(name);
        expect(sort()).toEqual(["name ascending"]);
    });

    it("ignores a column that is not sortable, a group, a body cell", () => {
        const { headerCell, click, sort } = setup();
        expect(click(headerCell(-1, 2)).handled).toBe(false);
        expect(click(headerCell(-2, 1)).handled).toBe(false);
        expect(click(headerCell(3, 0)).handled).toBe(false);
        expect(sort()).toEqual([]);
    });

    it("lets the consumer cancel it, and leaves a control inside the cell its own clicks", () => {
        const { engine, headerCell, click, sort } = setup();
        const id = headerCell(-2, 0);
        const button = document.createElement("button");
        const icon = document.createElement("span");
        button.append(icon);
        id.append(button);
        const prevented = new MouseEvent("click", {
            cancelable: true,
            button: 0,
            detail: 1,
        });
        prevented.preventDefault();
        Object.defineProperty(prevented, "target", { value: id });
        expect(engine.adapter.click(prevented)).toBe(false);
        expect(click(button).handled).toBe(false);
        expect(click(icon).handled).toBe(false);
        expect(sort()).toEqual([]);
        // the cell's own text is the cell's
        const label = document.createElement("span");
        id.append(label);
        expect(click(label).handled).toBe(true);
        expect(sort()).toEqual(["id ascending"]);
    });

    it("does not sort for a drag, a double click's second click, another button or Shift", () => {
        const { headerCell, click, sort } = setup();
        const id = headerCell(-2, 0);
        expect(click(id, {}, 20).handled).toBe(false);
        expect(click(id, { detail: 2 }).handled).toBe(false);
        expect(click(id, { button: 1 }).handled).toBe(false);
        expect(click(id, { shiftKey: true }).handled).toBe(false);
        expect(sort()).toEqual([]);
        // a few pixels of jitter is still a click
        expect(click(id, {}, 3).handled).toBe(true);
    });

    it("sorts for a click with no press (a screen reader, element.click()), whatever came before", () => {
        const { engine, headerCell, click, sort } = setup();
        const id = headerCell(-2, 0);
        click(id); // a press at (10, 10), consumed by its click
        const event = new MouseEvent("click", {
            cancelable: true,
            button: 0,
            detail: 0,
            clientX: 300,
            clientY: 200,
        });
        Object.defineProperty(event, "target", { value: id });
        expect(engine.adapter.click(event)).toBe(true);
        expect(sort()).toEqual(["id descending"]);
    });
});

describe("Enter and Space on a header cell", () => {
    it("toggle a sortable column, Ctrl or ⌘ adding it", () => {
        const { headerCell, key, sort } = setup();
        const id = headerCell(-2, 0);
        const name = headerCell(-1, 1);
        const enter = key(id, "Enter");
        expect(enter.handled).toBe(true);
        expect(enter.event.defaultPrevented).toBe(true);
        expect(sort()).toEqual(["id ascending"]);
        key(name, " ", { ctrlKey: true });
        expect(sort()).toEqual(["id ascending", "name ascending"]);
        key(id, " ");
        expect(sort()).toEqual(["id descending"]);
    });

    it("do nothing on a column that is not sortable, a group or a body cell, nor once prevented", () => {
        const { engine, headerCell, key, sort } = setup();
        expect(key(headerCell(-1, 2), "Enter").handled).toBe(false);
        expect(key(headerCell(-2, 1), "Enter").handled).toBe(false);
        expect(key(headerCell(0, 0), "Enter").handled).toBe(false);
        const id = headerCell(-2, 0);
        const prevented = new KeyboardEvent("keydown", {
            key: "Enter",
            cancelable: true,
        });
        prevented.preventDefault();
        Object.defineProperty(prevented, "target", { value: id });
        expect(engine.adapter.keydown(prevented)).toBe(false);
        // a button inside the cell activates itself
        const button = document.createElement("button");
        id.append(button);
        expect(key(button, "Enter").handled).toBe(false);
        expect(sort()).toEqual([]);
    });
});

describe("the view", () => {
    it("publishes a new view for a new sort, and tells each header cell how it shows it", () => {
        const { model, engine, view } = setup();
        const renders = vi.fn();
        engine.adapter.subscribe(renders);
        const before = view();
        model.run("sort-columns.set", {
            sortColumns: [
                { columnKey: "name", direction: "descending" },
                { columnKey: "id", direction: "ascending" },
            ],
        });
        const after = view();
        expect(renders).toHaveBeenCalledTimes(1);
        expect(after).not.toBe(before);
        const cells = after.headerRows.flatMap((row) => row.cells);
        const of = (key: string) => {
            const cell = cells.find((candidate) => candidate.key === key);
            if (!cell) throw new Error(`no header cell ${key}`);
            return headerCellSort(after, cell);
        };
        expect(of("name")).toEqual({
            sortable: true,
            direction: "descending",
            priority: 1,
            ariaSort: "descending",
        });
        expect(of("id")).toEqual({
            sortable: true,
            direction: "ascending",
            priority: 2,
            ariaSort: undefined,
        });
        expect(of("note")).toEqual({
            sortable: false,
            direction: undefined,
            priority: undefined,
            ariaSort: undefined,
        });
        expect(of("who").sortable).toBe(false);
    });
});
