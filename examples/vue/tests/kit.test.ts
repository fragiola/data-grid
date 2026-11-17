// @vitest-environment jsdom

import { mount } from "@vue/test-utils";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineComponent, h, nextTick } from "vue";
import { Badge } from "#/components/atoms/badge";
import { Clickable } from "#/components/atoms/clickable";
import { Input, Numeric, Textarea } from "#/components/atoms/fields";
import { field } from "#/components/families/field";
import { menu } from "#/components/families/menu";
import { popup } from "#/components/families/popup";
import { Avatar } from "#/components/ui/avatar";
import { Checkbox } from "#/components/ui/checkbox";
import { ContextMenu } from "#/components/ui/context-menu";
import { Select } from "#/components/ui/select";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import { Switch } from "#/components/ui/switch";
import { Tooltip } from "#/components/ui/tooltip";
import { cn } from "#/lib/cn";

// The Vue kit renders what the React kit does: the same roles, accessible names, `data-*` state and
// family classes (the shared e2e specs reach the examples through roles and names, the themes spec
// compares their looks).

beforeAll(() => {
    // what jsdom lacks and the primitives measure with
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    globalThis.PointerEvent ??= MouseEvent as typeof PointerEvent;
    Element.prototype.scrollIntoView ??= () => {};
    Element.prototype.hasPointerCapture ??= () => false;
    Element.prototype.releasePointerCapture ??= () => {};
});

const mounted: { unmount(): void }[] = [];
afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.unmount();
    document.body.innerHTML = "";
});

async function settle() {
    for (let i = 0; i < 4; i++) await nextTick();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await nextTick();
}

/** Mounts `render` into the page and waits for popups to render. */
async function render(render: () => ReturnType<typeof h>) {
    const host = document.createElement("div");
    document.body.append(host);
    const wrapper = mount(defineComponent({ render }), { attachTo: host });
    mounted.push(wrapper);
    await settle();
    return document;
}

const classes = (element: Element | null) =>
    element?.getAttribute("class")?.split(/\s+/) ?? [];

/** Every class of a family string is on the element. */
function expectFamily(element: Element | null, family: string) {
    expect(element).not.toBeNull();
    const have = classes(element);
    for (const name of family.split(/\s+/).filter(Boolean)) {
        expect(have, name).toContain(name);
    }
}

function select(props: Record<string, unknown> = {}) {
    return h(
        Select.Root,
        {
            items: { a: "Apples", b: "Bananas" },
            modelValue: "a",
            ...props,
        },
        {
            default: () => [
                h(
                    Select.Trigger,
                    { "aria-label": "Fruit" },
                    { default: () => h(Select.Value) },
                ),
                h(Select.Content, null, {
                    default: () => [
                        h(Select.Item, { value: "a" }, () => "Apples"),
                        h(Select.Item, { value: "b" }, () => "Bananas"),
                    ],
                }),
            ],
        },
    );
}

describe("Select", () => {
    it("is a named combobox wearing field.row, showing the chosen label", async () => {
        const doc = await render(() => select());
        const trigger = doc.querySelector('[role="combobox"]');
        expect(trigger?.getAttribute("aria-label")).toBe("Fruit");
        expectFamily(
            trigger,
            cn(field.row(), "flex-row items-center justify-between px-3 py-2"),
        );
        expect(trigger?.textContent).toContain("Apples");
    });

    it("opens a listbox of options, the chosen one selected", async () => {
        const doc = await render(() => select({ defaultOpen: true }));
        const list = doc.querySelector('[role="listbox"]');
        expectFamily(list, popup.content());
        expect(list?.hasAttribute("data-open")).toBe(true);
        const options = [...doc.querySelectorAll('[role="option"]')];
        expect(options.map((option) => option.textContent)).toEqual([
            "Apples",
            "Bananas",
        ]);
        expectFamily(options[0] ?? null, menu.selectableItem());
        expect(options[0]?.hasAttribute("data-selected")).toBe(true);
    });
});

describe("Checkbox", () => {
    it("is a named checkbox whose state is Base UI's data-*", async () => {
        const changes: [boolean, Event][] = [];
        const doc = await render(() =>
            h(
                Checkbox.Root,
                {
                    "aria-label": "Select Ada",
                    checked: false,
                    onCheckedChange: (
                        checked: boolean,
                        { event }: { event: Event },
                    ) => changes.push([checked, event]),
                },
                { default: () => h(Checkbox.Indicator) },
            ),
        );
        const box = doc.querySelector('[role="checkbox"]') as HTMLElement;
        expect(box.getAttribute("aria-label")).toBe("Select Ada");
        expect(box.getAttribute("aria-checked")).toBe("false");
        expect(box.hasAttribute("data-unchecked")).toBe(true);
        expect(box.hasAttribute("data-checked")).toBe(false);
        expectFamily(box, "field-control size-4 rounded-sm border");
        box.dispatchEvent(
            new MouseEvent("click", { bubbles: true, shiftKey: true }),
        );
        await nextTick();
        // controlled: it tells the change, with the click (Shift held), and shows the prop
        expect(changes).toHaveLength(1);
        expect(changes[0]?.[0]).toBe(true);
        expect((changes[0]?.[1] as MouseEvent | undefined)?.shiftKey).toBe(
            true,
        );
        expect(box.getAttribute("aria-checked")).toBe("false");
    });

    it("shows checked and indeterminate as React's does", async () => {
        const doc = await render(() =>
            h("div", [
                h(
                    Checkbox.Root,
                    { "aria-label": "All", indeterminate: true },
                    { default: () => h(Checkbox.Indicator) },
                ),
                h(
                    Checkbox.Root,
                    { "aria-label": "One", checked: true, disabled: true },
                    { default: () => h(Checkbox.Indicator) },
                ),
            ]),
        );
        const [all, one] = [...doc.querySelectorAll('[role="checkbox"]')];
        expect(all?.getAttribute("aria-checked")).toBe("mixed");
        expect(all?.hasAttribute("data-indeterminate")).toBe(true);
        expect(one?.getAttribute("aria-checked")).toBe("true");
        expect(one?.hasAttribute("data-checked")).toBe(true);
        expect(one?.hasAttribute("data-disabled")).toBe(true);
        expectFamily(
            one?.querySelector('[data-slot="checkbox-indicator"]') ?? null,
            "grid place-content-center",
        );
        expect(
            one?.querySelector('[data-slot="checkbox-indicator"] svg'),
        ).not.toBeNull();
    });
});

describe("Switch", () => {
    it("is a named switch whose checked state is data-checked, as Base UI's", async () => {
        const doc = await render(() =>
            h(
                Switch.Root,
                { "aria-label": "Dense rows", defaultValue: true },
                { default: () => h(Switch.Thumb) },
            ),
        );
        const control = doc.querySelector('[role="switch"]') as HTMLElement;
        expect(control.getAttribute("aria-label")).toBe("Dense rows");
        expect(control.getAttribute("aria-checked")).toBe("true");
        expect(control.hasAttribute("data-checked")).toBe(true);
        control.click();
        await nextTick();
        expect(control.getAttribute("aria-checked")).toBe("false");
        expect(control.hasAttribute("data-checked")).toBe(false);
        expect(
            doc
                .querySelector('[data-slot="switch-thumb"]')
                ?.hasAttribute("data-checked"),
        ).toBe(false);
    });
});

describe("ContextMenu", () => {
    it("opens a menu of items on a right click", async () => {
        const doc = await render(() =>
            h(ContextMenu.Root, null, {
                default: () => [
                    h(
                        ContextMenu.Trigger,
                        { "data-testid": "area" },
                        () => "Cell",
                    ),
                    h(ContextMenu.Content, null, {
                        default: () => [
                            h(ContextMenu.Item, null, () => "Copy"),
                            h(ContextMenu.Separator),
                            h(
                                ContextMenu.Item,
                                { disabled: true },
                                () => "Delete row",
                            ),
                        ],
                    }),
                ],
            }),
        );
        const area = doc.querySelector('[data-testid="area"]');
        expectFamily(area, "select-none");
        area?.dispatchEvent(
            new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: 10,
                clientY: 10,
            }),
        );
        await settle();
        const list = doc.querySelector('[role="menu"]');
        expectFamily(list, popup.content());
        const items = [...doc.querySelectorAll('[role="menuitem"]')];
        expect(items.map((item) => item.textContent)).toEqual([
            "Copy",
            "Delete row",
        ]);
        expectFamily(items[0] ?? null, menu.item());
        expect(items[1]?.hasAttribute("data-disabled")).toBe(true);
    });
});

describe("Tooltip", () => {
    it("shows its content as a tooltip wearing popup.tooltip", async () => {
        const doc = await render(() =>
            h(
                Tooltip.Root,
                { defaultOpen: true },
                {
                    default: () => [
                        h(
                            Tooltip.Trigger,
                            { "aria-label": "Locked" },
                            () => "🔒",
                        ),
                        h(Tooltip.Content, null, () => "Read only"),
                    ],
                },
            ),
        );
        const tooltip = doc.querySelector('[role="tooltip"]');
        expect(tooltip?.textContent).toBe("Read only");
        expectFamily(tooltip?.parentElement ?? null, popup.tooltip());
    });
});

describe("the plain parts", () => {
    it("Avatar shows its fallback on bg-palette-soft", async () => {
        const doc = await render(() =>
            h(Avatar.Root, null, {
                default: () =>
                    h(Avatar.Fallback, { "aria-label": "Acme" }, () => "AC"),
            }),
        );
        expectFamily(
            doc.querySelector('[data-slot="avatar"]'),
            "relative flex size-10 shrink-0 overflow-hidden rounded-full",
        );
        const fallback = doc.querySelector('[data-slot="avatar-fallback"]');
        expect(fallback?.textContent).toBe("AC");
        expectFamily(fallback, "bg-palette-soft text-palette-contrast");
    });

    it("Separator is a separator with its orientation", async () => {
        const doc = await render(() =>
            h(Separator, { orientation: "vertical", decorative: false }),
        );
        const separator = doc.querySelector('[role="separator"]');
        expect(separator?.getAttribute("data-orientation")).toBe("vertical");
        expectFamily(separator, "shrink-0 bg-palette-line");
    });

    it("Skeleton pulses on bg-palette-soft", async () => {
        const doc = await render(() => h(Skeleton, { class: "h-4 w-20" }));
        expectFamily(
            doc.querySelector('[data-slot="skeleton"]'),
            "animate-pulse rounded-md bg-palette-soft h-4 w-20",
        );
    });

    it("Badge, Clickable.Button and Input.Template.Simple", async () => {
        const doc = await render(() =>
            h("div", [
                h(
                    Badge,
                    { variant: "solid", "aria-label": "3 changes" },
                    () => "3",
                ),
                h(Clickable.Button, { variant: "ghost" }, () => "Reset"),
                h(Input.Template.Simple, { label: "Email", type: "email" }),
            ]),
        );
        expect(doc.querySelector('[aria-label="3 changes"]')?.textContent).toBe(
            "3",
        );
        const button = doc.querySelector("button");
        expect(button?.getAttribute("type")).toBe("button");
        expect(button?.textContent).toBe("Reset");
        const input = doc.querySelector("input") as HTMLInputElement;
        expect(input.labels?.[0]?.textContent).toBe("Email");
        expectFamily(input, field.control());
    });

    it("Numeric steps with the arrow keys within its bounds, then calls the consumer's keydown", async () => {
        const keys: string[] = [];
        const doc = await render(() =>
            h("div", [
                h(Numeric, {
                    "aria-label": "Budget",
                    min: 0,
                    max: 250,
                    step: 100,
                    value: "200",
                    onKeydown: (event: KeyboardEvent) => keys.push(event.key),
                }),
                h(Textarea, { "aria-label": "Notes", rows: 3 }),
            ]),
        );
        const input = doc.querySelector(
            '[data-slot="numeric"]',
        ) as HTMLInputElement;
        expect(input.type).toBe("number");
        expectFamily(input, field.control());
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true }),
        );
        expect(input.value).toBe("250");
        input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
        );
        expect(input.value).toBe("150");
        expect(keys).toEqual(["ArrowUp", "ArrowDown"]);
        expectFamily(
            doc.querySelector('[data-slot="textarea"]'),
            cn(field.control(), "min-h-control"),
        );
    });
});
