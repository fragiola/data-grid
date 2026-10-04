// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
    CELL_SELECTOR,
    CTRL_KEYS,
    cellSelector,
    FOCUSABLE,
    hiddenWithin,
    isCellNode,
    isControl,
    isEditable,
    isElement,
    isPagelessControl,
    KEYS,
    movesWithArrows,
    ownerViewport,
    PAGE_KEYS,
    VIEWPORTS,
} from "../../src/engine/dom";

// The engine's DOM predicates: stateless, over elements of any document.

afterEach(() => {
    document.body.innerHTML = "";
});

/** The first element of an HTML fragment. */
function html(markup: string): Element {
    const template = document.createElement("template");
    template.innerHTML = markup.trim();
    const element = template.content.firstElementChild;
    if (!element) throw new Error(`no element in ${markup}`);
    document.body.append(element);
    return element;
}

describe("the keys", () => {
    it("map the arrows, Home/End and the page keys to moves", () => {
        expect(KEYS.ArrowUp).toBe("up");
        expect(KEYS.ArrowRight).toBe("right");
        expect(KEYS.Home).toBe("row-start");
        expect(KEYS.PageDown).toBe("page-down");
        expect(CTRL_KEYS.Home).toBe("grid-start");
        expect(CTRL_KEYS.End).toBe("grid-end");
        expect(KEYS.Enter).toBeUndefined();
    });

    it("know the keys a scroll container pages itself by", () => {
        for (const key of ["PageUp", "End", "ArrowLeft"]) {
            expect(PAGE_KEYS.has(key)).toBe(true);
        }
        expect(PAGE_KEYS.has("Tab")).toBe(false);
    });
});

describe("isElement", () => {
    it("is true for an element only", () => {
        expect(isElement(html("<div></div>"))).toBe(true);
        expect(isElement(document.createTextNode("text"))).toBe(false);
        expect(isElement(document)).toBe(false);
        expect(isElement(null)).toBe(false);
        expect(isElement({ nodeType: 3 })).toBe(false);
    });
});

describe("isEditable", () => {
    it("is true for fields and editable content", () => {
        for (const markup of [
            "<input />",
            "<textarea></textarea>",
            "<select></select>",
        ]) {
            expect(isEditable(html(markup))).toBe(true);
        }
        const editable = html("<div></div>") as HTMLElement;
        Object.defineProperty(editable, "isContentEditable", { value: true });
        expect(isEditable(editable)).toBe(true);
    });

    it("is false for anything else", () => {
        expect(isEditable(html("<button></button>"))).toBe(false);
        expect(isEditable(html("<div></div>"))).toBe(false);
    });
});

describe("isControl", () => {
    it("is true for the controls of HTML and links with an address", () => {
        for (const markup of [
            "<button></button>",
            "<input />",
            "<select></select>",
            "<textarea></textarea>",
            "<summary></summary>",
            "<label></label>",
            '<a href="#x"></a>',
        ]) {
            expect(isControl(html(markup))).toBe(true);
        }
    });

    it("is true for a control's role, and a widget holding controls", () => {
        expect(isControl(html('<div role="button"></div>'))).toBe(true);
        expect(isControl(html('<div role="menu"></div>'))).toBe(true);
        expect(isControl(html('<div role="dialog"></div>'))).toBe(true);
    });

    it("is false for a link without an address and plain content", () => {
        expect(isControl(html("<a></a>"))).toBe(false);
        expect(isControl(html("<span></span>"))).toBe(false);
        expect(isControl(html('<div role="presentation"></div>'))).toBe(false);
    });
});

describe("FOCUSABLE", () => {
    it("selects what takes focus in a cell", () => {
        const cell = html(
            `<div>
                <a href="#x">link</a><a>no address</a><button>b</button>
                <input /><span tabindex="0">s</span>
                <div contenteditable="true">e</div><div contenteditable="false">n</div>
            </div>`,
        );
        expect(
            [...cell.querySelectorAll(FOCUSABLE)].map((element) =>
                element.tagName.toLowerCase(),
            ),
        ).toEqual(["a", "button", "input", "span", "div"]);
    });
});

describe("movesWithArrows", () => {
    it("is true for a radio, a menu item and a tab", () => {
        expect(movesWithArrows(html('<input type="radio" />'))).toBe(true);
        expect(movesWithArrows(html('<input type="RADIO" />'))).toBe(true);
        expect(movesWithArrows(html('<div role="radio"></div>'))).toBe(true);
        expect(movesWithArrows(html('<div role="menuitem"></div>'))).toBe(true);
        expect(movesWithArrows(html('<div role="tab"></div>'))).toBe(true);
    });

    it("is false for other controls", () => {
        expect(movesWithArrows(html("<button></button>"))).toBe(false);
        expect(movesWithArrows(html('<input type="checkbox" />'))).toBe(false);
    });
});

describe("isPagelessControl", () => {
    it("is true for buttons, links and boxes to check", () => {
        for (const markup of [
            "<button></button>",
            "<summary></summary>",
            "<a></a>",
            '<input type="checkbox" />',
            '<input type="submit" />',
            '<div role="switch"></div>',
            '<div role="link"></div>',
        ]) {
            expect(isPagelessControl(html(markup))).toBe(true);
        }
    });

    it("is false for fields, lists and plain content", () => {
        for (const markup of [
            "<input />",
            '<input type="number" />',
            "<textarea></textarea>",
            "<select></select>",
            '<div role="listbox"></div>',
            "<div></div>",
        ]) {
            expect(isPagelessControl(html(markup))).toBe(false);
        }
    });
});

describe("the cells", () => {
    it("are the elements carrying both indexes", () => {
        const cell = html(
            '<div data-row-index="2" data-column-index="3"></div>',
        );
        expect(isCellNode(cell)).toBe(true);
        expect(isCellNode(html('<div data-row-index="2"></div>'))).toBe(false);
        expect(cell.matches(CELL_SELECTOR)).toBe(true);
        expect(
            cell.matches(cellSelector({ rowIndex: 2, columnIndex: 3 })),
        ).toBe(true);
        expect(
            cell.matches(cellSelector({ rowIndex: 3, columnIndex: 2 })),
        ).toBe(false);
    });

    it("belong to the nearest attached viewport above them", () => {
        const outer = html(
            `<div id="outer">
                <div id="cell" data-row-index="0" data-column-index="0">
                    <div id="inner"><span id="leaf"></span></div>
                </div>
            </div>`,
        );
        const inner = outer.querySelector("#inner");
        const leaf = outer.querySelector("#leaf");
        if (!inner || !leaf) throw new Error("fixture");
        expect(ownerViewport(leaf)).toBe(null);
        VIEWPORTS.add(outer);
        expect(ownerViewport(leaf)).toBe(outer);
        VIEWPORTS.add(inner);
        expect(ownerViewport(leaf)).toBe(inner);
        expect(ownerViewport(inner)).toBe(inner);
        VIEWPORTS.delete(inner);
        VIEWPORTS.delete(outer);
    });
});

describe("hiddenWithin", () => {
    it("is true when the element or a parent inside the cell is hidden or inert", () => {
        const cell = html(
            `<div>
                <div hidden><button id="hidden"></button></div>
                <div inert><button id="inert"></button></div>
                <button id="shown"></button>
            </div>`,
        );
        const find = (id: string) => {
            const element = cell.querySelector(`#${id}`);
            if (!element) throw new Error(id);
            return element;
        };
        expect(hiddenWithin(find("hidden"), cell)).toBe(true);
        expect(hiddenWithin(find("inert"), cell)).toBe(true);
        expect(hiddenWithin(find("shown"), cell)).toBe(false);
    });

    it("ignores what is above the cell", () => {
        const outside = html(
            '<div hidden><div id="cell"><button></button></div></div>',
        );
        const cell = outside.querySelector("#cell");
        const button = outside.querySelector("button");
        if (!cell || !button) throw new Error("fixture");
        expect(hiddenWithin(button, cell)).toBe(false);
    });
});
