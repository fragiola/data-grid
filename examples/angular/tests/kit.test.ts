// @vitest-environment jsdom

import { Component, signal, type Type } from "@angular/core";
import { TestBed } from "@angular/core/testing";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Badge } from "#/components/atoms/badge";
import { ClickableButton } from "#/components/atoms/clickable";
import { FIELDS } from "#/components/atoms/fields";
import { field } from "#/components/families/field";
import { menu } from "#/components/families/menu";
import { popup } from "#/components/families/popup";
import { AVATAR } from "#/components/ui/avatar";
import { CHECKBOX, type CheckedChange } from "#/components/ui/checkbox";
import { CONTEXT_MENU } from "#/components/ui/context-menu";
import { SELECT_PARTS } from "#/components/ui/select";
import { Separator } from "#/components/ui/separator";
import { Skeleton } from "#/components/ui/skeleton";
import { SWITCH } from "#/components/ui/switch";
import { TOOLTIP } from "#/components/ui/tooltip";
import { cn } from "#/lib/cn";

// The Angular kit renders what the React kit does: the same roles, accessible names, Base UI's
// `data-*` state and the family classes (the shared e2e specs reach the examples through roles,
// names and `data-*`).

beforeAll(() => {
    // what jsdom lacks and the parts measure with
    globalThis.ResizeObserver ??= class {
        observe() {}
        unobserve() {}
        disconnect() {}
    };
    globalThis.PointerEvent ??= MouseEvent as typeof PointerEvent;
    Element.prototype.scrollIntoView ??= () => {};
});

afterEach(() => {
    TestBed.resetTestingModule();
    document.body.innerHTML = "";
});

async function render<T>(component: Type<T>) {
    const fixture = TestBed.createComponent(component);
    const root = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
    return {
        root,
        fixture,
        stable: async () => {
            await Promise.resolve();
            await fixture.whenStable();
        },
    };
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

const text = (element: Element | null | undefined) =>
    element?.textContent?.trim();

@Component({
    imports: [SELECT_PARTS],
    template: `
        <button
            [kitSelectTrigger]="list"
            [(value)]="value"
            [items]="items"
            aria-label="Team"
            class="w-40"
        >
            <span kitSelectValue></span>
        </button>
        <ng-template #list>
            <div kitSelectContent data-grid-editor="edit-1">
                <div kitSelectItem="a">Alpha</div>
                <div kitSelectItem="b">Beta</div>
            </div>
        </ng-template>
    `,
})
class SelectHost {
    readonly items = { a: "Alpha", b: "Beta" };
    readonly value = signal<unknown>("a");
}

@Component({
    imports: [SELECT_PARTS],
    template: `
        <button [kitSelectTrigger]="list" [items]="items" value="b" defaultOpen aria-label="Status">
            <span kitSelectValue></span>
        </button>
        <ng-template #list>
            <div kitSelectContent>
                <div kitSelectItem="a">Alpha</div>
                <div kitSelectItem="b">Beta</div>
            </div>
        </ng-template>
    `,
})
class OpenSelectHost {
    readonly items = { a: "Alpha", b: "Beta" };
}

describe("Select", () => {
    it("is a named combobox wearing field.row, showing the chosen label", async () => {
        const { root } = await render(SelectHost);
        const trigger = root.querySelector('[role="combobox"]');
        expect(trigger?.getAttribute("aria-label")).toBe("Team");
        expect(trigger?.getAttribute("aria-haspopup")).toBe("listbox");
        expect(trigger?.getAttribute("aria-expanded")).toBe("false");
        expectFamily(
            trigger,
            cn(
                field.row(),
                "flex-row items-center justify-between px-3 py-2",
                "w-40",
            ),
        );
        expect(text(trigger)).toBe("Alpha");
    });

    it("opens a listbox of options, the chosen one selected, and picks one", async () => {
        const { root, fixture, stable } = await render(SelectHost);
        const trigger = root.querySelector<HTMLElement>('[role="combobox"]');
        trigger?.click();
        await stable();
        expect(trigger?.getAttribute("aria-expanded")).toBe("true");
        const list = document.querySelector('[role="listbox"]');
        expectFamily(list, popup.content());
        expect(list?.hasAttribute("data-open")).toBe(true);
        // what the app puts on the content stays (an edit's `editorProps`)
        expect(list?.getAttribute("data-grid-editor")).toBe("edit-1");
        const options = [
            ...document.querySelectorAll<HTMLElement>('[role="option"]'),
        ];
        expect(options.map(text)).toEqual(["Alpha", "Beta"]);
        expectFamily(options[0] ?? null, menu.selectableItem());
        expect(options[0]?.hasAttribute("data-selected")).toBe(true);
        expect(options[0]?.getAttribute("aria-selected")).toBe("true");

        options[1]?.click();
        await stable();
        await stable();
        expect(fixture.componentInstance.value()).toBe("b");
        expect(document.querySelector('[role="listbox"]')).toBeNull();
        expect(text(trigger)).toBe("Beta");
    });

    it("opens once rendered with defaultOpen", async () => {
        const { stable } = await render(OpenSelectHost);
        await stable();
        expect(document.querySelector('[role="listbox"]')).not.toBeNull();
        expect(
            document
                .querySelector('[role="option"][data-selected]')
                ?.textContent?.trim(),
        ).toBe("Beta");
    });
});

@Component({
    imports: [CHECKBOX],
    template: `
        <button
            kitCheckbox
            [checked]="checked()"
            [indeterminate]="indeterminate()"
            aria-label="Select row"
            (checkedChange)="changes.push($event)"
        >
            <span kitCheckboxIndicator></span>
        </button>
        <button kitCheckbox disabled aria-label="Locked"><span kitCheckboxIndicator></span></button>
    `,
})
class CheckboxHost {
    readonly checked = signal(false);
    readonly indeterminate = signal(false);
    readonly changes: CheckedChange[] = [];
}

describe("Checkbox", () => {
    it("is a named checkbox whose state is Base UI's data-*", async () => {
        const { root, fixture, stable } = await render(CheckboxHost);
        const box = root.querySelector<HTMLElement>(
            '[aria-label="Select row"]',
        );
        expect(box?.getAttribute("role")).toBe("checkbox");
        expect(box?.getAttribute("type")).toBe("button");
        expect(box?.getAttribute("aria-checked")).toBe("false");
        expect(box?.hasAttribute("data-unchecked")).toBe(true);
        expectFamily(box, "field-control size-4 border-palette-line");
        expect(box?.querySelector("svg")).toBeNull();

        box?.click();
        expect(fixture.componentInstance.changes.map((c) => c.checked)).toEqual(
            [true],
        );
        expect(fixture.componentInstance.changes[0]?.event.type).toBe("click");
        // the app gives the state back: the box keeps none of its own
        expect(box?.getAttribute("aria-checked")).toBe("false");

        fixture.componentInstance.checked.set(true);
        await stable();
        expect(box?.getAttribute("aria-checked")).toBe("true");
        expect(box?.hasAttribute("data-checked")).toBe(true);
        expect(box?.hasAttribute("data-unchecked")).toBe(false);
        const indicator = box?.querySelector(
            '[data-slot="checkbox-indicator"]',
        );
        expect(indicator?.hasAttribute("data-checked")).toBe(true);
        expect(indicator?.querySelector("svg")).not.toBeNull();
        box?.click();
        expect(fixture.componentInstance.changes.at(-1)?.checked).toBe(false);
    });

    it("shows indeterminate as mixed, asking to be checked; Enter does not toggle it", async () => {
        const { root, fixture, stable } = await render(CheckboxHost);
        fixture.componentInstance.indeterminate.set(true);
        await stable();
        const box = root.querySelector<HTMLElement>(
            '[aria-label="Select row"]',
        );
        expect(box?.getAttribute("aria-checked")).toBe("mixed");
        expect(box?.hasAttribute("data-indeterminate")).toBe(true);
        box?.click();
        expect(fixture.componentInstance.changes.at(-1)?.checked).toBe(true);
        const enter = new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
        });
        box?.dispatchEvent(enter);
        expect(enter.defaultPrevented).toBe(true);
    });

    it("is disabled with data-disabled, telling no change", async () => {
        const { root, fixture } = await render(CheckboxHost);
        const box = root.querySelector<HTMLButtonElement>(
            '[aria-label="Locked"]',
        );
        expect(box?.disabled).toBe(true);
        expect(box?.hasAttribute("data-disabled")).toBe(true);
        box?.click();
        expect(fixture.componentInstance.changes).toEqual([]);
    });
});

@Component({
    imports: [SWITCH],
    template: `<button kitSwitch [(checked)]="on" aria-label="Live"><span kitSwitchThumb></span></button>`,
})
class SwitchHost {
    readonly on = signal(true);
}

describe("Switch", () => {
    it("is a named switch whose checked state is data-checked, as Base UI's", async () => {
        const { root, fixture, stable } = await render(SwitchHost);
        const control = root.querySelector('[role="switch"]') as HTMLElement;
        expect(control.getAttribute("aria-label")).toBe("Live");
        expect(control.getAttribute("aria-checked")).toBe("true");
        expect(control.hasAttribute("data-checked")).toBe(true);
        control.click();
        await stable();
        expect(fixture.componentInstance.on()).toBe(false);
        expect(control.getAttribute("aria-checked")).toBe("false");
        expect(control.hasAttribute("data-unchecked")).toBe(true);
        expect(
            root
                .querySelector('[data-slot="switch-thumb"]')
                ?.hasAttribute("data-checked"),
        ).toBe(false);
    });
});

@Component({
    imports: [CONTEXT_MENU],
    template: `
        <div
            [kitContextMenuTrigger]="menu"
            #trigger="kitContextMenuTrigger"
            (openChange)="opened.set($event)"
            data-testid="area"
        >
            Row
        </div>
        <ng-template #menu>
            <div kitContextMenuContent>
                <div kitContextMenuItem (select)="picked.set('insert')">Insert row</div>
                <div kitContextMenuSeparator></div>
                <div kitContextMenuItem disabled>Delete row</div>
            </div>
        </ng-template>
    `,
})
class ContextMenuHost {
    readonly opened = signal(false);
    readonly picked = signal<string | undefined>(undefined);
}

describe("ContextMenu", () => {
    it("opens a menu of items on a right click, and runs the picked one", async () => {
        const { root, fixture, stable } = await render(ContextMenuHost);
        const area = root.querySelector('[data-testid="area"]');
        const press = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 10,
            clientY: 10,
        });
        area?.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);
        await stable();
        expect(fixture.componentInstance.opened()).toBe(true);
        expectFamily(document.querySelector('[role="menu"]'), popup.content());
        const items = [
            ...document.querySelectorAll<HTMLElement>('[role="menuitem"]'),
        ];
        expect(items.map(text)).toEqual(["Insert row", "Delete row"]);
        expectFamily(items[0] ?? null, menu.item());
        expect(items[1]?.hasAttribute("data-disabled")).toBe(true);
        expect(document.querySelector('[role="separator"]')).not.toBeNull();
        items[0]?.click();
        await stable();
        await stable();
        expect(fixture.componentInstance.picked()).toBe("insert");
        expect(document.querySelector('[role="menu"]')).toBeNull();
        expect(fixture.componentInstance.opened()).toBe(false);
    });

    it("closes on a press outside, on Escape and when asked", async () => {
        const { root, fixture, stable } = await render(ContextMenuHost);
        const area = root.querySelector('[data-testid="area"]');
        const open = async () => {
            area?.dispatchEvent(
                new MouseEvent("contextmenu", {
                    bubbles: true,
                    cancelable: true,
                }),
            );
            await stable();
            expect(document.querySelector('[role="menu"]')).not.toBeNull();
        };
        await open();
        document.body.dispatchEvent(
            new PointerEvent("pointerdown", { bubbles: true }),
        );
        await stable();
        expect(document.querySelector('[role="menu"]')).toBeNull();
        await open();
        document.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
        );
        await stable();
        expect(document.querySelector('[role="menu"]')).toBeNull();
        await open();
        fixture.debugElement.children[0]?.references.trigger.close();
        await stable();
        expect(document.querySelector('[role="menu"]')).toBeNull();
        expect(fixture.componentInstance.opened()).toBe(false);
    });

    it("stays closed when closed as it opens, from its openChange", async () => {
        const { root, fixture, stable } = await render(ContextMenuHost);
        const trigger = fixture.debugElement.children[0]?.references.trigger;
        const said: boolean[] = [];
        trigger.openChange.subscribe((open: boolean) => {
            said.push(open);
            if (open) trigger.close();
        });
        root.querySelector('[data-testid="area"]')?.dispatchEvent(
            new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
        );
        await stable();
        expect(document.querySelector('[role="menu"]')).toBeNull();
        expect(trigger.open()).toBe(false);
        expect(said).toEqual([true, false]);
    });
});

@Component({
    imports: [TOOLTIP],
    template: `
        <button [kitTooltipTrigger]="tip" [delay]="0" aria-label="Info">i</button>
        <ng-template #tip><div kitTooltipContent side="inline-end">Saved</div></ng-template>
    `,
})
class TooltipHost {}

describe("Tooltip", () => {
    it("shows its content as a tooltip wearing popup.tooltip", async () => {
        const { root, stable } = await render(TooltipHost);
        const trigger = root.querySelector('[aria-label="Info"]');
        trigger?.dispatchEvent(
            new PointerEvent("pointerenter", { pointerType: "mouse" }),
        );
        await new Promise((resolve) => setTimeout(resolve, 0));
        await stable();
        const tooltip = document.querySelector('[role="tooltip"]');
        expect(text(tooltip)).toBe("Saved");
        expectFamily(tooltip, popup.tooltip());
        trigger?.dispatchEvent(new PointerEvent("pointerleave"));
        await stable();
        expect(document.querySelector('[role="tooltip"]')).toBeNull();
    });
});

@Component({
    imports: [AVATAR, Separator, Skeleton, Badge, ClickableButton, FIELDS],
    template: `
        <span kitAvatar data-testid="avatar"><span kitAvatarFallback>AB</span></span>
        <div kitSeparator orientation="vertical" data-testid="separator"></div>
        <div kitSkeleton class="h-4 w-24" data-testid="skeleton"></div>
        <span kitBadge variant="solid" data-testid="badge">3</span>
        <button kitClickable variant="ghost" size="sm" data-testid="button">Reset</button>
        <kit-input-simple
            label="Row"
            description="From 1"
            inputmode="numeric"
            [value]="row()"
            (valueChange)="row.set($event)"
            data-testid="row"
        />
        <kit-input-simple ariaLabel="Search" placeholder="Search" class="w-48">
            <svg kitInset="start" data-testid="icon"></svg>
        </kit-input-simple>
        <input kitNumeric aria-label="Amount" [min]="0" [max]="300" [step]="100" value="250"
            (keydown)="keys.push($event.key)" />
        <textarea kitTextarea aria-label="Notes"></textarea>
    `,
})
class NativeHost {
    readonly row = signal("12");
    readonly keys: string[] = [];
}

describe("the plain parts", () => {
    it("Avatar shows its fallback on bg-palette-soft", async () => {
        const { root } = await render(NativeHost);
        const fallback = root.querySelector('[data-slot="avatar-fallback"]');
        expect(text(fallback)).toBe("AB");
        expectFamily(fallback, "bg-palette-soft rounded-full");
        expectFamily(
            root.querySelector('[data-testid="avatar"]'),
            "size-10 rounded-full overflow-hidden",
        );
    });

    it("Separator is a separator with its orientation, Skeleton pulses", async () => {
        const { root } = await render(NativeHost);
        const separator = root.querySelector('[data-testid="separator"]');
        expect(separator?.getAttribute("role")).toBe("separator");
        expect(separator?.getAttribute("aria-orientation")).toBe("vertical");
        expect(separator?.getAttribute("data-orientation")).toBe("vertical");
        expectFamily(separator, "bg-palette-line");
        expectFamily(
            root.querySelector('[data-testid="skeleton"]'),
            "animate-pulse bg-palette-soft h-4 w-24",
        );
    });

    it("Badge and Clickable wear their variants", async () => {
        const { root } = await render(NativeHost);
        expectFamily(
            root.querySelector('[data-testid="badge"]'),
            "bg-palette-base",
        );
        const button = root.querySelector('[data-testid="button"]');
        expect(button?.getAttribute("type")).toBe("button");
        expectFamily(button, "bg-transparent h-8");
    });

    it("the simple input is labelled and described, and tells what is typed", async () => {
        const { root, fixture, stable } = await render(NativeHost);
        const [row, search] = [
            ...root.querySelectorAll<HTMLInputElement>(
                "kit-input-simple input",
            ),
        ];
        expect(text(row?.labels?.[0])).toBe("Row");
        expect(row?.getAttribute("inputmode")).toBe("numeric");
        expectFamily(row ?? null, field.control());
        const described = row?.getAttribute("aria-describedby") ?? "";
        expect(text(root.querySelector(`[id="${described}"]`))).toBe("From 1");
        expect(row?.value).toBe("12");
        if (row) row.value = "40";
        row?.dispatchEvent(new Event("input"));
        await stable();
        expect(fixture.componentInstance.row()).toBe("40");
        expect(search?.getAttribute("aria-label")).toBe("Search");
        expect(search?.getAttribute("placeholder")).toBe("Search");
        // the inset goes inside the body, the class on the body
        const icon = root.querySelector('[data-testid="icon"]');
        expectFamily(icon?.parentElement ?? null, field.inset());
        expectFamily(
            search?.closest('[data-slot="field-body"]') ?? null,
            cn(field.body(), "w-48"),
        );
    });

    it("Numeric steps with the arrow keys within its bounds, then the app's keydown runs", async () => {
        const { root, fixture } = await render(NativeHost);
        const amount = root.querySelector<HTMLInputElement>(
            '[aria-label="Amount"]',
        );
        expect(amount?.getAttribute("type")).toBe("number");
        const press = (key: string) =>
            amount?.dispatchEvent(
                new KeyboardEvent("keydown", { key, bubbles: true }),
            );
        press("ArrowUp");
        expect(amount?.value).toBe("300");
        press("ArrowUp");
        expect(amount?.value).toBe("300");
        press("ArrowDown");
        expect(amount?.value).toBe("200");
        expect(fixture.componentInstance.keys).toEqual([
            "ArrowUp",
            "ArrowUp",
            "ArrowDown",
        ]);
        expectFamily(
            root.querySelector('[aria-label="Notes"]'),
            cn(field.control(), "min-h-control"),
        );
    });
});
