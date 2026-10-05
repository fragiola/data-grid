import { afterEach, vi } from "vitest";
import {
    createDataGridEngine,
    createDataGridModel,
    type DataGridEngine,
    type DataGridEngineOptions,
    type DataGridModelOptions,
    type GridView,
} from "../../src";
import type { Row } from "./views";

// The engine against a DOM jsdom cannot lay out: the viewport's client size and scroll offsets and
// ResizeObserver are faked, and the cells are the elements an adapter would render. Importing it
// empties the page after each test.

export type { Row };

let observed: (() => void) | null = null;

afterEach(() => {
    document.body.innerHTML = "";
    observed = null;
});

class FakeResizeObserver {
    readonly #callback: () => void;
    constructor(callback: () => void) {
        this.#callback = callback;
        observed = callback;
    }
    observe() {}
    disconnect() {
        if (observed === this.#callback) observed = null;
    }
}

/** Fakes ResizeObserver; the function it returns runs the last observer's callback, a resize. */
export function fakeResizeObserver(): () => void {
    vi.stubGlobal("ResizeObserver", FakeResizeObserver);
    return () => observed?.();
}

export interface FakeViewportOptions {
    width: number;
    height: number;
    /** the view whose scrollable range keeps the offsets, as a browser does (default: kept as set) */
    clampTo?: () => GridView<Row>;
}

/**
 * A viewport of `width` × `height` (`size` changes it, before a resize) whose scroll offsets are
 * kept in `scroll`.
 */
export function fakeViewport({ width, height, clampTo }: FakeViewportOptions) {
    const element = document.createElement("div");
    const size = { width, height };
    const scroll = { top: 0, left: 0 };
    const clamp = (value: number, max: (view: GridView<Row>) => number) =>
        clampTo
            ? Math.min(Math.max(value, 0), Math.max(max(clampTo()), 0))
            : value;
    Object.defineProperties(element, {
        clientWidth: { get: () => size.width },
        clientHeight: { get: () => size.height },
        scrollTop: {
            get: () => scroll.top,
            set: (value: number) => {
                scroll.top = clamp(
                    value,
                    (view) => view.headerHeight + view.height - size.height,
                );
            },
        },
        scrollLeft: {
            get: () => scroll.left,
            set: (value: number) => {
                // 0 to the maximum, or laid out right to left (its `dir`, the page's) the
                // maximum's mirror to 0
                const sign =
                    getComputedStyle(element).direction === "rtl" ? -1 : 1;
                scroll.left =
                    sign *
                    clamp(sign * value, (view) => view.width - size.width);
            },
        },
    });
    return { element, size, scroll };
}

export interface MountOptions extends DataGridEngineOptions {
    /** the viewport's client width (default 400) */
    width?: number;
    /** the viewport's client height (default 260) */
    height?: number;
    /** keep the scroll offsets in the view's scrollable range */
    clamp?: boolean;
    /** the layers to register inside the grid layer, in order (default none) */
    layers?: readonly ("header" | "body")[];
    /** the grid layer, holding what the adapter rendered before the engine attaches */
    grid?: HTMLElement;
}

/**
 * A model of `Row`s (20px rows, 30px header rows, every row loaded unless `modelOptions` says
 * otherwise) and its engine, attached to a fake viewport in the page holding the grid layer, and
 * the first view committed.
 */
export function mountEngine(
    modelOptions: DataGridModelOptions<Row>,
    options: MountOptions = {},
) {
    const {
        width = 400,
        height = 260,
        clamp = false,
        layers = [],
        grid = document.createElement("div"),
        ...engineOptions
    } = options;
    const resize = fakeResizeObserver();
    const model = createDataGridModel<Row>({
        getRow: (id) => ({ id }),
        rowHeight: 20,
        headerRowHeight: 30,
        ...modelOptions,
    });
    const engine = createDataGridEngine(model, engineOptions);
    const view = () => engine.adapter.getView();
    const {
        element: viewport,
        size,
        scroll,
    } = fakeViewport({
        width,
        height,
        ...(clamp ? { clampTo: view } : {}),
    });
    const header = document.createElement("div");
    const body = document.createElement("div");
    body.dataset.layer = "body";
    const registered = { header, body };
    grid.append(...layers.map((name) => registered[name]));
    viewport.append(grid);
    document.body.append(viewport);
    // the adapter's part: the viewport's `dir` is the direction the model is given, rendered
    // before it attaches and with every view
    const renderDir = () => {
        const given = engine.adapter.getView().givenDirection;
        if (given) viewport.setAttribute("dir", given);
        else viewport.removeAttribute("dir");
    };
    renderDir();
    engine.adapter.subscribe(renderDir);
    const detach = engine.adapter.attach(viewport);
    engine.adapter.registerLayer("grid", grid);
    for (const name of layers) {
        engine.adapter.registerLayer(name, registered[name]);
    }
    const commit = () => engine.adapter.commit(view());
    commit();
    return {
        model,
        engine,
        view,
        viewport,
        grid,
        header,
        body,
        size,
        scroll,
        resize,
        detach,
        commit,
    };
}

/** A cell's element as an adapter renders it, holding `html`, appended to `parent`. */
export function cellElement(
    parent: Element,
    rowIndex: number,
    columnIndex: number,
    html = "",
): HTMLElement {
    const element = document.createElement("div");
    element.dataset.rowIndex = String(rowIndex);
    element.dataset.columnIndex = String(columnIndex);
    element.tabIndex = -1;
    if (html) element.innerHTML = html;
    parent.append(element);
    return element;
}

/** A keydown from `target`, as the adapter gets it (not dispatched). */
export function keyEvent(
    target: Element | null,
    key: string,
    init: KeyboardEventInit = {},
): KeyboardEvent {
    const event = new KeyboardEvent("keydown", {
        key,
        bubbles: true,
        cancelable: true,
        ...init,
    });
    Object.defineProperty(event, "target", {
        value: target,
        configurable: true,
    });
    return event;
}

/** A keydown from `target` handed to the engine: whether it handled it, and the event. */
export function keydown(
    engine: DataGridEngine<Row>,
    target: Element,
    key: string,
    init: KeyboardEventInit = {},
): { handled: boolean; event: KeyboardEvent } {
    const event = keyEvent(target, key, init);
    return { handled: engine.adapter.keydown(event), event };
}

/**
 * A press on `target` and its click handed to the engine, as a browser sends them; `moved` pixels
 * between the two.
 */
export function click(
    engine: DataGridEngine<Row>,
    target: Element,
    init: MouseEventInit = {},
    moved = 0,
): { handled: boolean; event: MouseEvent } {
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
}

/** DOM changes reach the engine's observer as a microtask: let it run. */
export const settled = () =>
    new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Animation frames the engine asks for, kept until `frame()` runs the ones asked for so far
 * (stubbed globals: the page's `defaultView`). Call it in a `beforeEach`, and unstub after.
 */
export function stubAnimationFrames() {
    const frames = new Map<number, FrameRequestCallback>();
    let next = 0;
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
        next += 1;
        frames.set(next, callback);
        return next;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
    const frame = () => {
        const waiting = [...frames.values()];
        frames.clear();
        for (const callback of waiting) callback(0);
    };
    return { frames, frame };
}

/**
 * A pointer event on `target` (the primary button held until the release), dispatched; a press
 * then goes to the engine after the page's own handlers, as the root hands it over.
 */
export function pointer(
    engine: DataGridEngine<Row>,
    target: Element,
    type: string,
    clientX: number,
    init: PointerEventInit = {},
): PointerEvent {
    const released = type === "pointerup" || type === "pointercancel";
    const event = new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        button: 0,
        buttons: released ? 0 : 1,
        pointerId: 1,
        clientX,
        clientY: 10,
        ...init,
    });
    target.dispatchEvent(event);
    if (type === "pointerdown") engine.adapter.pointerdown(event);
    return event;
}

/**
 * Fakes the layout a measure reads (Epic #80, A3): `element`'s box is `content` wide while its
 * inline width is `max-content`, else as wide as its inline width (0 without one).
 */
export function fakeContentWidth(element: HTMLElement, content: number): void {
    element.getBoundingClientRect = () => {
        const { width } = element.style;
        return DOMRect.fromRect({
            width:
                width === "max-content"
                    ? content
                    : Number.parseFloat(width) || 0,
            height: 20,
        });
    };
}
