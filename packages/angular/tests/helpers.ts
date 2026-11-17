import type { Type } from "@angular/core";
import { type ComponentFixture, TestBed } from "@angular/core/testing";
import { afterAll, beforeAll } from "vitest";

// What the Angular tests share (the React and Vue tests' helpers, for Angular): a grid root's
// size (jsdom lays nothing out), rendering a grid, counting renders (D9), the parts by their
// `data-grid-part` and indexes.

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

/** Template renders, by name: a template calls `rendered("cell")` in a binding (D9). */
const renderCounts = new Map<string, number>();

/** Counts one render of `name` (call it from a template's binding); returns an empty string. */
export function rendered(name: string): string {
    renderCounts.set(name, (renderCounts.get(name) ?? 0) + 1);
    return "";
}

/** The renders of `name` since the last `resetRenders()`. */
export const rendersOf = (name: string) => renderCounts.get(name) ?? 0;

/** Every render since the last `resetRenders()`. */
export const renders = () =>
    [...renderCounts.values()].reduce((sum, count) => sum + count, 0);

export const resetRenders = () => renderCounts.clear();

/** A rendered grid: its fixture and its element (attached to the document, so focus works). */
export interface Rendered<C> {
    readonly fixture: ComponentFixture<C>;
    readonly container: HTMLElement;
    readonly component: C;
}

/**
 * Renders a standalone component (`setup` gives it its inputs first) and lets it settle (its first
 * render, the engine's attach).
 */
export async function render<C>(
    component: Type<C>,
    setup?: (fixture: ComponentFixture<C>) => void,
): Promise<Rendered<C>> {
    const fixture = TestBed.createComponent(component);
    setup?.(fixture);
    await settled(fixture);
    return {
        fixture,
        container: fixture.nativeElement as HTMLElement,
        component: fixture.componentInstance,
    };
}

/** Lets Angular render (signals, change detection, after-render hooks) and the engine settle. */
export async function settled(fixture?: ComponentFixture<unknown>) {
    for (let i = 0; i < 3; i++) {
        await (fixture
            ? fixture.whenStable()
            : TestBed.inject(
                  // the application's own stability, without a fixture
                  (await import("@angular/core")).ApplicationRef,
              ).whenStable());
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
}

/** Scrolls a grid's root to `top` and `left` (the ones given) and fires its scroll. */
export function scrollRoot(
    element: HTMLElement,
    { top, left }: { top?: number; left?: number },
) {
    if (top !== undefined) element.scrollTop = top;
    if (left !== undefined) element.scrollLeft = left;
    element.dispatchEvent(new Event("scroll"));
}

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

/** Fires a native event at `target` (keys, pointers, clicks). */
export function fire<E extends Event>(target: EventTarget, event: E): E {
    target.dispatchEvent(event);
    return event;
}

/** A key pressed on `target`: its `keydown`, bubbling and cancelable. */
export function keyDown(target: EventTarget, init: KeyboardEventInit) {
    return fire(
        target,
        new KeyboardEvent("keydown", {
            bubbles: true,
            cancelable: true,
            ...init,
        }),
    );
}

/** A click on `target`, bubbling. */
export function click(target: HTMLElement, init: MouseEventInit = {}) {
    return fire(
        target,
        new MouseEvent("click", { bubbles: true, cancelable: true, ...init }),
    );
}

/** A pointer press on `target`, bubbling and cancelable. */
export function pointerDown(target: EventTarget, init: PointerEventInit = {}) {
    const Pointer =
        typeof PointerEvent === "function" ? PointerEvent : MouseEvent;
    return fire(
        target,
        new Pointer("pointerdown", {
            bubbles: true,
            cancelable: true,
            button: 0,
            ...init,
        }),
    );
}
