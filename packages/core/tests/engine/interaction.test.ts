// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
    type CellPosition,
    type Column,
    createDataGridEngine,
    createDataGridModel,
    TAB_STOP_ATTRIBUTE,
} from "../../src";

// Interactive cells (Epic #52, I1–I5): the grid keeps the controls inside its cells out of the
// tab order; Enter or F2 hand a cell's keys to its controls, Tab cycles them, Escape gives the
// keys back; a click on a control does the same as Enter.

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

const COLUMNS: Column<Row>[] = [
    { key: "a", width: 100, sortable: true },
    { key: "b", width: 100 },
    { key: "c", width: 100 },
];

/** DOM changes reach the engine's observer as a microtask: let it run. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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
    /** a cell as an adapter renders it, holding `html` */
    const cell = (rowIndex: number, columnIndex: number, html = "") => {
        const element = document.createElement("div");
        element.dataset.rowIndex = String(rowIndex);
        element.dataset.columnIndex = String(columnIndex);
        element.tabIndex = -1;
        element.innerHTML = html;
        grid.append(element);
        return element;
    };
    // cells before the grid attaches, as React renders them first
    const actions = cell(
        0,
        1,
        '<button id="edit">Edit</button><a id="open" href="#x">Open</a>',
    );
    const field = cell(1, 1, '<input id="name" />');
    const plain = cell(2, 1);
    engine.adapter.attach(viewport);
    engine.adapter.registerLayer("grid", grid);
    engine.adapter.commit(view());
    const key = (
        target: Element,
        name: string,
        init: KeyboardEventInit = {},
    ) => {
        const event = new KeyboardEvent("keydown", {
            key: name,
            cancelable: true,
            bubbles: true,
            ...init,
        });
        Object.defineProperty(event, "target", { value: target });
        return { handled: engine.adapter.keydown(event), event };
    };
    const byId = (id: string) => {
        const element = document.getElementById(id);
        if (!element) throw new Error(`no #${id}`);
        return element;
    };
    return {
        model,
        engine,
        viewport,
        grid,
        cell,
        actions,
        field,
        plain,
        key,
        byId,
    };
}

describe("the tab order", () => {
    it("keeps the cells' controls out of it, and the ones the app marks in it", async () => {
        const { byId, cell } = setup();
        expect(byId("edit").getAttribute("tabindex")).toBe("-1");
        expect(byId("open").getAttribute("tabindex")).toBe("-1");
        expect(byId("name").getAttribute("tabindex")).toBe("-1");
        // a cell rendered later, and an app's own tab stop
        cell(
            3,
            2,
            `<button id="later">Later</button><button id="kept" ${TAB_STOP_ATTRIBUTE} tabindex="0">Kept</button>`,
        );
        await settled();
        expect(byId("later").getAttribute("tabindex")).toBe("-1");
        expect(byId("kept").getAttribute("tabindex")).toBe("0");
    });

    it("takes a control out again when a re-render gives it a tab index back", async () => {
        const { byId } = setup();
        byId("edit").setAttribute("tabindex", "0");
        await settled();
        expect(byId("edit").getAttribute("tabindex")).toBe("-1");
    });

    it("leaves a nested grid's elements to that grid", async () => {
        const { cell, byId } = setup();
        const holder = cell(4, 2);
        const inner = document.createElement("div");
        holder.append(inner);
        const innerEngine = createDataGridEngine(
            createDataGridModel<Row>({ columns: COLUMNS, rows: [] }),
        );
        innerEngine.adapter.attach(inner);
        inner.innerHTML = '<button id="inside" tabindex="0">Inside</button>';
        await settled();
        expect(byId("inside").getAttribute("tabindex")).toBe("0");
    });
});

describe("entering and leaving", () => {
    it("enters on Enter or F2 on a cell with controls, focusing the first, and tells", () => {
        const { engine, actions, field, key, byId } = setup();
        const seen: (CellPosition | null)[] = [];
        engine.subscribe("interaction", (value) => seen.push(value));
        const enter = key(actions, "Enter");
        expect(enter.handled).toBe(true);
        expect(enter.event.defaultPrevented).toBe(true);
        expect(engine.get("interaction")).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        expect(document.activeElement).toBe(byId("edit"));
        expect(engine.adapter.getView().interaction).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        // the controls are back in the order while their cell has the keys
        expect(byId("edit").hasAttribute("tabindex")).toBe(false);
        key(byId("edit"), "Escape");
        key(field, "F2");
        expect(document.activeElement).toBe(byId("name"));
        expect(seen).toEqual([
            { rowIndex: 0, columnIndex: 1 },
            null,
            { rowIndex: 1, columnIndex: 1 },
        ]);
    });

    it("lets Enter through on a cell without controls", () => {
        const { engine, plain, key } = setup();
        expect(key(plain, "Enter").handled).toBe(false);
        expect(engine.get("interaction")).toBeNull();
    });

    it("cycles Tab and Shift+Tab inside the cell, wrapping, never out of it", () => {
        const { actions, key, byId } = setup();
        key(actions, "Enter");
        const tab = key(byId("edit"), "Tab");
        expect(tab.handled).toBe(true);
        expect(tab.event.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(byId("open"));
        key(byId("open"), "Tab");
        expect(document.activeElement).toBe(byId("edit"));
        key(byId("edit"), "Tab", { shiftKey: true });
        expect(document.activeElement).toBe(byId("open"));
    });

    it("leaves on Escape, focusing the cell and taking the controls out again", () => {
        const { engine, actions, key, byId } = setup();
        key(actions, "Enter");
        const leaving = key(byId("open"), "Escape");
        expect(leaving.handled).toBe(true);
        expect(engine.get("interaction")).toBeNull();
        expect(document.activeElement).toBe(actions);
        expect(byId("edit").getAttribute("tabindex")).toBe("-1");
    });

    it("gives a field its own keys, Escape and Tab aside", () => {
        const { engine, model, field, key, byId } = setup();
        key(field, "Enter");
        expect(key(byId("name"), "ArrowDown").handled).toBe(false);
        expect(key(byId("name"), "Home").handled).toBe(false);
        expect(model.state.activePosition).toEqual({
            rowIndex: 1,
            columnIndex: 1,
        });
        expect(key(byId("name"), "Escape").handled).toBe(true);
        expect(engine.get("interaction")).toBeNull();
    });

    it("enters when a control takes focus itself (a click), and leaves when focus goes elsewhere", () => {
        const { engine, model, plain, byId } = setup();
        byId("open").focus();
        expect(engine.get("interaction")).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        expect(model.state.activePosition).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        expect(document.activeElement).toBe(byId("open"));
        plain.focus();
        expect(engine.get("interaction")).toBeNull();
        expect(model.state.activePosition).toEqual({
            rowIndex: 2,
            columnIndex: 1,
        });
    });

    it("leaves when focus leaves the grid", () => {
        const { engine, actions, key } = setup();
        key(actions, "Enter");
        const outside = document.createElement("button");
        document.body.append(outside);
        outside.focus();
        expect(engine.get("interaction")).toBeNull();
    });

    it("lets the consumer cancel Enter, F2, Tab and Escape", () => {
        const { engine, actions, key, byId } = setup();
        const prevented = (target: Element, name: string) => {
            const event = new KeyboardEvent("keydown", {
                key: name,
                cancelable: true,
            });
            event.preventDefault();
            Object.defineProperty(event, "target", { value: target });
            return engine.adapter.keydown(event);
        };
        expect(prevented(actions, "Enter")).toBe(false);
        expect(prevented(actions, "F2")).toBe(false);
        expect(engine.get("interaction")).toBeNull();
        key(actions, "Enter");
        expect(prevented(byId("edit"), "Tab")).toBe(false);
        expect(prevented(byId("edit"), "Escape")).toBe(false);
        expect(engine.get("interaction")).not.toBeNull();
    });

    it("answers the actions, and leaves when the app makes another cell active", () => {
        const { engine, model, byId } = setup();
        engine.run("interact-cell", { rowIndex: 1, columnIndex: 1 });
        expect(document.activeElement).toBe(byId("name"));
        engine.run("leave-cell", {});
        expect(engine.get("interaction")).toBeNull();
        engine.run("interact-cell", { rowIndex: 0, columnIndex: 1 });
        model.run("active-position.set", { rowIndex: 5, columnIndex: 0 });
        expect(engine.get("interaction")).toBeNull();
    });
});

describe("header cells", () => {
    it("sort on Enter when sortable, enter on F2; enter on Enter when not sortable", () => {
        const { engine, model, cell, key } = setup();
        const sortable = cell(-1, 0, '<button id="menu-a">Menu</button>');
        const plainHeader = cell(-1, 1, '<button id="menu-b">Menu</button>');
        key(sortable, "Enter");
        expect(model.state.sortColumns).toEqual([
            { columnKey: "a", direction: "ascending" },
        ]);
        expect(engine.get("interaction")).toBeNull();
        key(sortable, "F2");
        expect(engine.get("interaction")).toEqual({
            rowIndex: -1,
            columnIndex: 0,
        });
        engine.run("leave-cell", {});
        key(plainHeader, "Enter");
        expect(engine.get("interaction")).toEqual({
            rowIndex: -1,
            columnIndex: 1,
        });
    });
});

describe("scrolling", () => {
    it("reads and writes nothing for the controls while scrolling inside the overscan", async () => {
        const { viewport } = setup();
        const changes: MutationRecord[] = [];
        const watch = new MutationObserver((records) =>
            changes.push(...records),
        );
        watch.observe(viewport, {
            subtree: true,
            attributes: true,
            attributeFilter: ["tabindex"],
        });
        viewport.scrollTop = 20;
        viewport.dispatchEvent(new Event("scroll"));
        await settled();
        watch.disconnect();
        expect(changes).toHaveLength(0);
    });
});

describe("review cases", () => {
    it("clears the view's interaction when the app makes another cell active", () => {
        const { engine, model, actions, key } = setup();
        key(actions, "Enter");
        model.run("active-position.set", { rowIndex: 5, columnIndex: 0 });
        expect(engine.adapter.getView().interaction).toBeNull();
    });

    it("does not enter a cell a middleware sends the activation elsewhere from", () => {
        const { engine, model, actions, key } = setup();
        model.use((ctx, next) => {
            if (ctx.command === "active-position.set") {
                ctx.payload = { rowIndex: 9, columnIndex: 0 };
            }
            return next();
        });
        expect(key(actions, "Enter").handled).toBe(false);
        expect(engine.get("interaction")).toBeNull();
    });

    it("never traps Tab on the app's own tab stop, and gives a newly marked one its index back", async () => {
        const { engine, cell, key, byId } = setup();
        const holder = cell(
            6,
            2,
            `<button id="own" ${TAB_STOP_ATTRIBUTE}>Own</button><button id="later-own" tabindex="0">Later</button>`,
        );
        await settled();
        byId("own").focus();
        expect(engine.get("interaction")).toBeNull();
        expect(key(byId("own"), "Tab").handled).toBe(false);
        expect(byId("later-own").getAttribute("tabindex")).toBe("-1");
        byId("later-own").setAttribute(TAB_STOP_ATTRIBUTE, "");
        await settled();
        expect(byId("later-own").getAttribute("tabindex")).toBe("0");
        void holder;
    });

    it("cycles past a wrapper the app took out of the order, to the buttons inside it", () => {
        const { cell, key, byId } = setup();
        const toolbar = cell(
            7,
            2,
            '<div role="toolbar" tabindex="-1"><button id="t1">One</button><button id="t2">Two</button></div>',
        );
        key(toolbar, "Enter");
        expect(document.activeElement).toBe(byId("t1"));
        key(byId("t1"), "Tab");
        expect(document.activeElement).toBe(byId("t2"));
    });

    it("keeps a button's page keys from paging the container, and a composition's keys its own", () => {
        const { engine, actions, field, key, byId } = setup();
        key(actions, "Enter");
        const page = key(byId("edit"), "PageDown");
        expect(page.handled).toBe(true);
        expect(page.event.defaultPrevented).toBe(true);
        key(byId("edit"), "Escape");
        key(field, "Enter");
        expect(key(byId("name"), "Escape", { isComposing: true }).handled).toBe(
            false,
        );
        expect(engine.get("interaction")).not.toBeNull();
    });

    it("enters a cell asked for before it was rendered, once a commit shows it", () => {
        const { engine, model, cell, byId } = setup();
        engine.run("interact-cell", { rowIndex: 50, columnIndex: 2 });
        expect(model.state.activePosition).toEqual({
            rowIndex: 50,
            columnIndex: 2,
        });
        expect(engine.get("interaction")).toBeNull();
        cell(50, 2, '<button id="far">Far</button>');
        engine.adapter.commit(engine.adapter.getView());
        expect(engine.get("interaction")).toEqual({
            rowIndex: 50,
            columnIndex: 2,
        });
        expect(document.activeElement).toBe(byId("far"));
    });
});

describe("second review cases", () => {
    it("passes over a control that cannot take focus, and stays in navigation when none can", () => {
        const { engine, cell, key, byId } = setup();
        const holder = cell(
            8,
            2,
            '<button id="gone">Gone</button><button id="here">Here</button>',
        );
        // hidden by the app's CSS: focus does not land on it
        byId("gone").focus = () => {};
        key(holder, "Enter");
        expect(document.activeElement).toBe(byId("here"));
        key(byId("here"), "Tab");
        expect(document.activeElement).toBe(byId("here"));
        key(byId("here"), "Escape");
        byId("here").focus = () => {};
        expect(key(holder, "Enter").handled).toBe(false);
        expect(engine.get("interaction")).toBeNull();
    });

    it("enters once a controlled parent follows the activation a click asked for", () => {
        const { engine, model, byId } = setup();
        let controlled = true;
        model.use((ctx, next) =>
            ctx.command === "active-position.set" && controlled
                ? {
                      ok: false,
                      error: { code: "vetoed", message: "controlled" },
                  }
                : next(),
        );
        byId("edit").focus();
        expect(engine.get("interaction")).toBeNull();
        // the parent follows: the prop sets the position
        controlled = false;
        model.run("active-position.set", { rowIndex: 0, columnIndex: 1 });
        expect(engine.get("interaction")).toEqual({
            rowIndex: 0,
            columnIndex: 1,
        });
        expect(document.activeElement).toBe(byId("edit"));
    });

    it("drops an entry waiting for a cell once another one is made active", () => {
        const { engine, model, cell } = setup();
        engine.run("interact-cell", { rowIndex: 60, columnIndex: 2 });
        model.run("active-position.set", { rowIndex: 2, columnIndex: 0 });
        cell(60, 2, '<button id="late">Late</button>');
        engine.adapter.commit(engine.adapter.getView());
        expect(engine.get("interaction")).toBeNull();
    });

    it("leaves the page keys to media and scrolling controls", () => {
        const { cell, key, byId } = setup();
        const holder = cell(
            9,
            2,
            '<video id="clip" controls></video><button id="play">Play</button>',
        );
        key(holder, "Enter");
        expect(key(byId("clip"), "Home").handled).toBe(false);
        expect(key(byId("play"), "Home").handled).toBe(true);
    });
});
