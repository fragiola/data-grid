// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    createDataGridEngine,
    createDataGridModel,
    type RowSelection,
    veto,
} from "../../src";

// The selection's keys (Epic #57, R6): Shift+Space toggles the active row, Shift+Up/Down extend
// from the anchor, Ctrl/⌘+A selects every row; on body rows only, in navigation only, with rows
// selectable, through commands.

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

/** `null`: rows not selectable */
function setup(rowSelection: RowSelection | null = "multiple") {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    const model = createDataGridModel<Row>({
        columns: [
            { key: "id", width: 80 },
            { key: "name", width: 120 },
        ],
        rowCount: 100,
        getRow: (id) => ({ id }),
        rowKey: (row) => `r${row.id}`,
        rowHeight: 20,
        headerRowHeight: 30,
        rowSelection: rowSelection ?? undefined,
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
    /** a cell's element, as an adapter renders it */
    const cell = (rowIndex: number, columnIndex = 0, html = "") => {
        const element = document.createElement("div");
        element.dataset.rowIndex = String(rowIndex);
        element.dataset.columnIndex = String(columnIndex);
        element.tabIndex = -1;
        element.innerHTML = html;
        grid.append(element);
        return element;
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
    const activate = (rowIndex: number, columnIndex = 0) => {
        model.run("active-position.set", { rowIndex, columnIndex });
        return cell(rowIndex, columnIndex);
    };
    const keys = () => model.state.selectedRowKeys;
    return { model, engine, cell, key, activate, keys };
}

describe("Shift+Space", () => {
    it("toggles the active row and makes it the anchor", () => {
        const { model, key, activate, keys } = setup();
        const target = activate(3);
        const press = key(target, " ", { shiftKey: true });
        expect(press.handled).toBe(true);
        expect(press.event.defaultPrevented).toBe(true);
        expect(keys()).toEqual(["r3"]);
        expect(model.state.selectionAnchor?.rowIndex).toBe(3);
        key(target, " ", { shiftKey: true });
        expect(keys()).toEqual([]);
    });

    it("ignores a held key's repeats", () => {
        const { key, activate, keys } = setup();
        const target = activate(3);
        key(target, " ", { shiftKey: true });
        expect(key(target, " ", { shiftKey: true, repeat: true }).handled).toBe(
            true,
        );
        expect(keys()).toEqual(["r3"]);
    });

    it("selects one row in single mode, replacing the other", () => {
        const { key, activate, keys } = setup("single");
        key(activate(3), " ", { shiftKey: true });
        key(activate(5), " ", { shiftKey: true });
        expect(keys()).toEqual(["r5"]);
    });
});

describe("Shift+Up and Shift+Down", () => {
    it("move and extend the selection from the row they start on", () => {
        const { model, key, activate, keys } = setup();
        const target = activate(2);
        expect(key(target, "ArrowDown", { shiftKey: true }).handled).toBe(true);
        expect(model.state.activePosition).toEqual({
            rowIndex: 3,
            columnIndex: 0,
        });
        expect(keys()).toEqual(["r2", "r3"]);
        key(target, "ArrowDown", { shiftKey: true });
        expect(keys()).toEqual(["r2", "r3", "r4"]);
        expect(model.state.selectionAnchor?.rowIndex).toBe(2);
    });

    it("extend from the anchor Shift+Space set", () => {
        const { key, activate, keys } = setup();
        key(activate(5), " ", { shiftKey: true });
        key(activate(5), "ArrowUp", { shiftKey: true });
        key(activate(4), "ArrowUp", { shiftKey: true });
        expect(keys()).toEqual(["r5", "r4", "r3"]);
    });

    it("start from a row already selected without an anchor, keeping it", () => {
        const { model, key, activate, keys } = setup();
        model.run("selected-rows.set", { rowKeys: ["r2"] });
        key(activate(2), "ArrowDown", { shiftKey: true });
        expect(keys()).toEqual(["r2", "r3"]);
    });

    it("extend to the row the move reached, when a middleware redirects it", () => {
        const { model, key, activate, keys } = setup();
        model.use((ctx, next) => {
            if (ctx.command === "active-position.move" && !ctx.dryRun) {
                ctx.payload = {
                    ...ctx.payload,
                    direction: "page-down",
                    pageSize: 3,
                };
            }
            return next();
        });
        key(activate(2), "ArrowDown", { shiftKey: true });
        expect(model.state.activePosition?.rowIndex).toBe(5);
        expect(keys()).toEqual(["r2", "r3", "r4", "r5"]);
    });

    it("run one selection command a key, so a controlled parent answers each", () => {
        const { model, key, activate } = setup();
        const commands: string[] = [];
        model.use((ctx, next) => {
            if (ctx.command.startsWith("selected-rows.") && !ctx.dryRun) {
                commands.push(ctx.command);
            }
            return next();
        });
        key(activate(2), "ArrowDown", { shiftKey: true });
        expect(commands).toEqual(["selected-rows.toggle"]);
    });

    it("move into the header as plain arrows, selecting nothing", () => {
        const { model, key, activate, keys } = setup();
        key(activate(0), "ArrowUp", { shiftKey: true });
        expect(model.state.activePosition?.rowIndex).toBe(-1);
        expect(keys()).toEqual([]);
    });

    it("select nothing when the move is refused", () => {
        const { model, key, activate, keys } = setup();
        model.use((ctx, next) =>
            ctx.command === "active-position.move" ? veto() : next(),
        );
        key(activate(2), "ArrowDown", { shiftKey: true });
        expect(keys()).toEqual([]);
    });

    it("are plain moves in single mode and without selection", () => {
        for (const mode of ["single", null] as const) {
            const { model, key, activate, keys } = setup(mode);
            key(activate(2), "ArrowDown", { shiftKey: true });
            expect(model.state.activePosition?.rowIndex).toBe(3);
            expect(keys()).toEqual([]);
            document.body.innerHTML = "";
        }
    });
});

describe("Ctrl+A and ⌘+A", () => {
    it("select every row, prevented even when refused", () => {
        const { model, key, activate, keys } = setup();
        const target = activate(1);
        const press = key(target, "a", { ctrlKey: true });
        expect(press.handled).toBe(true);
        expect(press.event.defaultPrevented).toBe(true);
        expect(keys()).toHaveLength(100);
        model.run("selected-rows.set", { rowKeys: [] });
        model.run("data.set", {
            rowCount: 100,
            getRow: (id) => (id === 50 ? undefined : { id }),
        });
        const refused = key(target, "A", { metaKey: true });
        expect(refused.event.defaultPrevented).toBe(true);
        expect(keys()).toEqual([]);
    });

    it("are the page's in single mode", () => {
        const { key, activate, keys } = setup("single");
        const press = key(activate(1), "a", { ctrlKey: true });
        expect(press.event.defaultPrevented).toBe(false);
        expect(keys()).toEqual([]);
    });
});

describe("whose keys they are", () => {
    it("never from a header cell, even with a body row active", () => {
        const { model, key, cell, keys } = setup();
        model.run("active-position.set", { rowIndex: 3, columnIndex: 0 });
        const header = cell(-1, 0);
        key(header, " ", { shiftKey: true });
        key(header, "a", { ctrlKey: true });
        expect(keys()).toEqual([]);
    });

    it("never a header cell's", () => {
        const { key, activate, keys } = setup();
        const header = activate(-1);
        key(header, " ", { shiftKey: true });
        key(header, "a", { ctrlKey: true });
        expect(keys()).toEqual([]);
    });

    it("never with rows not selectable: Shift+Space and Ctrl+A stay the page's", () => {
        const { key, activate, keys } = setup(null);
        const target = activate(2);
        expect(
            key(target, " ", { shiftKey: true }).event.defaultPrevented,
        ).toBe(false);
        expect(key(target, "a", { ctrlKey: true }).event.defaultPrevented).toBe(
            false,
        );
        expect(keys()).toEqual([]);
    });

    it("never a key the consumer prevented", () => {
        const { engine, activate, keys } = setup();
        const target = activate(2);
        const event = new KeyboardEvent("keydown", {
            key: " ",
            shiftKey: true,
            cancelable: true,
        });
        event.preventDefault();
        Object.defineProperty(event, "target", { value: target });
        expect(engine.adapter.keydown(event)).toBe(false);
        expect(keys()).toEqual([]);
    });

    it("never in interaction: the cell's controls have them", () => {
        const { model, key, cell, keys } = setup();
        model.run("active-position.set", { rowIndex: 2, columnIndex: 1 });
        const holder = cell(2, 1, '<input id="field" />');
        key(holder, "Enter");
        const field = holder.querySelector("input") as HTMLInputElement;
        expect(document.activeElement).toBe(field);
        key(field, " ", { shiftKey: true });
        key(field, "a", { ctrlKey: true });
        expect(keys()).toEqual([]);
    });
});
