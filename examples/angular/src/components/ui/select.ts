// Angular port of the Fragiola UI select (examples/react/src/components/ui/select.tsx): the same
// parts, classes and palette roles, over Angular CDK's listbox (`cdkListbox`, `cdkOption`: roles,
// arrow keys, typeahead, Home and End).
//
// Select — the recombination test. This component is field + popup + menu, and it declares no new
// style. Every class comes from a family:
//   - Trigger uses field.row (the box) + layout
//   - Content uses popup.content (the floating box)
//   - Item uses menu.selectableItem (the option with indicator space)
//   - ItemIndicator uses menu.itemIndicator
//
// What differs from the React one, and why:
//   - The trigger is the root: `value`/`valueChange` (`[(value)]`) and `items` are its inputs, and
//     it is given the list's template, whose root element is the content (Angular's way to render
//     a list only while it is open):
//
//         <button [kitSelectTrigger]="list" [(value)]="region" [items]="REGIONS" aria-label="Region">
//             <span kitSelectValue></span>
//         </button>
//         <ng-template #list>
//             <div kitSelectContent>
//                 @for (item of REGIONS; track item.value) {
//                     <div [kitSelectItem]="item.value">{{ item.label }}</div>
//                 }
//             </div>
//         </ng-template>
//
//   - Base UI marks state with `data-open`/`data-selected`; the parts add those attributes, so the
//     families' variants apply unchanged.
//   - The list opens under the trigger in the body of the trigger's document (`#/components/floating`).

import { CdkListbox, CdkOption } from "@angular/cdk/listbox";
import {
    afterNextRender,
    booleanAttribute,
    Component,
    computed,
    Directive,
    effect,
    InjectionToken,
    inject,
    input,
    model,
    type OnInit,
    type TemplateRef,
} from "@angular/core";
import { LucideCheck, LucideChevronDown } from "@lucide/angular";
import { field } from "#/components/families/field";
import { menu } from "#/components/families/menu";
import { popup } from "#/components/families/popup";
import {
    type Align,
    injectPopup,
    POPUP,
    type Side,
} from "#/components/floating";
import { cn } from "#/lib/cn";

/** The options' labels, by value: an array of `{ value, label }` or a record, as Base UI takes. */
export type SelectItems =
    | readonly { value: unknown; label: string }[]
    | Readonly<Record<string, string>>;

function labelOf(items: SelectItems | undefined, value: unknown) {
    if (!items) return undefined;
    if (Array.isArray(items)) {
        return (items as readonly { value: unknown; label: string }[]).find(
            (item) => item.value === value,
        )?.label;
    }
    return typeof value === "string"
        ? (items as Record<string, string>)[value]
        : undefined;
}

let nextId = 0;

/** The select an open list belongs to (its trigger). */
const SELECT = new InjectionToken<SelectTrigger>("kit-select");

/** The select itself: a field row with the chosen label and a chevron, opening the list. */
@Component({
    selector: "[kitSelectTrigger]",
    exportAs: "kitSelectTrigger",
    imports: [LucideChevronDown],
    host: {
        type: "button",
        role: "combobox",
        "aria-haspopup": "listbox",
        "data-slot": "select-trigger",
        "[attr.aria-expanded]": "popup.open()",
        "[attr.aria-controls]": "popup.open() ? listId : null",
        "[attr.data-popup-open]": "popup.open() ? '' : null",
        "[class]": "classes()",
        "(click)": "toggle()",
        "(keydown.arrowdown)": "openFromKeyboard($event)",
        "(keydown.arrowup)": "openFromKeyboard($event)",
    },
    template: `<ng-content /><svg lucideChevronDown class="size-4 text-palette-accent/85"></svg>`,
})
export class SelectTrigger {
    readonly kitSelectTrigger = input.required<TemplateRef<unknown>>();
    /** The chosen value (`null`: none). */
    readonly value = model<unknown>(null);
    /** The options' labels, so `kitSelectValue` shows the chosen one before the list ever opened. */
    readonly items = input<SelectItems>();
    /** Opens the list once the trigger is rendered (Base UI's `defaultOpen`). */
    readonly defaultOpen = input(false, { transform: booleanAttribute });
    readonly class = input<string>();
    protected readonly popup = injectPopup(undefined, [
        { provide: SELECT, useFactory: () => this },
    ]);
    /** The id of the open list. */
    readonly listId = `kit-select-list-${++nextId}`;
    /** The chosen value's label, when `items` has it. */
    readonly label = computed(() => labelOf(this.items(), this.value()));
    // The trigger IS a field row. The box (border, background, focus ring) comes from field.row;
    // the layout (flex-row, padding) is the trigger's own.
    protected readonly classes = computed(() =>
        cn(
            field.row(),
            "flex-row items-center justify-between px-3 py-2",
            this.class(),
        ),
    );

    constructor() {
        afterNextRender(() => {
            if (this.defaultOpen() && !this.popup.open()) this.toggle();
        });
    }

    toggle() {
        if (this.popup.open()) {
            this.popup.hide();
        } else {
            this.popup.show(this.kitSelectTrigger(), { side: "bottom" });
        }
    }

    /** Picks `value` (a click or Enter on an option) and closes the list. */
    pick(value: unknown) {
        this.value.set(value);
        this.popup.hide();
    }

    protected openFromKeyboard(event: Event) {
        event.preventDefault();
        if (!this.popup.open()) this.toggle();
    }
}

/** The chosen value's label (from the trigger's `items`), or what it contains when none. */
@Component({
    selector: "[kitSelectValue]",
    host: {
        "data-slot": "select-value",
        "[class]": "classes()",
    },
    template: `{{ trigger.label() ?? "" }}@if (trigger.label() === undefined) {<ng-content />}`,
})
export class SelectValue {
    readonly class = input<string>();
    protected readonly trigger = inject(SelectTrigger);
    protected readonly classes = computed(() =>
        cn("text-sm text-palette-accent/85", this.class()),
    );
}

/** The list: the root element of the trigger's template. */
@Directive({
    selector: "[kitSelectContent]",
    hostDirectives: [CdkListbox],
    host: {
        "data-slot": "select-content",
        "data-open": "",
        "[id]": "select.listId",
        "[class]": "classes()",
    },
})
export class SelectContent implements OnInit {
    readonly class = input<string>();
    readonly side = input<Side>("bottom");
    readonly align = input<Align>("start");
    readonly sideOffset = input(4);
    readonly alignOffset = input(0);
    private readonly popup = inject(POPUP);
    protected readonly select = inject(SELECT);
    private readonly listbox = inject(CdkListbox);
    protected readonly classes = computed(() =>
        cn(popup.content("z-50 outline-none"), this.class()),
    );

    constructor() {
        effect(() => {
            const value = this.select.value();
            this.listbox.value = value === null ? [] : [value];
        });
    }

    ngOnInit() {
        this.popup.placement({
            side: this.side(),
            align: this.align(),
            sideOffset: this.sideOffset(),
            alignOffset: this.alignOffset(),
        });
        // the keyboard lands on the chosen option (or the first one)
        queueMicrotask(() => this.listbox.focus());
    }
}

/** An option: its check sits in the indicator space on the end side while it is chosen. */
@Component({
    selector: "[kitSelectItem]",
    imports: [LucideCheck],
    hostDirectives: [
        { directive: CdkOption, inputs: ["cdkOptionDisabled: disabled"] },
    ],
    host: {
        "data-slot": "select-item",
        "[attr.data-selected]": "selected() ? '' : null",
        "[class]": "classes()",
        "(click)": "pick()",
        "(keydown.enter)": "pick()",
        "(keydown.space)": "pick()",
    },
    template: `
        <span data-slot="select-item-indicator" [class]="indicator">
            @if (selected()) {
                <svg lucideCheck></svg>
            }
        </span>
        <ng-content />
    `,
})
export class SelectItem {
    readonly kitSelectItem = input.required<unknown>();
    readonly class = input<string>();
    private readonly select = inject(SELECT);
    private readonly option = inject(CdkOption);
    protected readonly selected = computed(
        () => this.select.value() === this.kitSelectItem(),
    );
    protected readonly classes = computed(() =>
        cn(menu.selectableItem(), this.class()),
    );
    protected readonly indicator = menu.itemIndicator();

    constructor() {
        effect(() => {
            this.option.value = this.kitSelectItem();
        });
    }

    protected pick() {
        if (this.option.disabled) return;
        // after the listbox handled the press (it closes with the list)
        queueMicrotask(() => this.select.pick(this.kitSelectItem()));
    }
}

/** A group of options with its label. */
@Directive({
    selector: "[kitSelectGroup]",
    host: { role: "group", "data-slot": "select-group" },
})
export class SelectGroup {}

@Directive({
    selector: "[kitSelectLabel]",
    host: { "data-slot": "select-label", "[class]": "classes()" },
})
export class SelectLabel {
    readonly class = input<string>();
    protected readonly classes = computed(() => cn(menu.label(), this.class()));
}

@Directive({
    selector: "[kitSelectSeparator]",
    host: {
        role: "separator",
        "data-slot": "select-separator",
        "[class]": "classes()",
    },
})
export class SelectSeparator {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(menu.separator(), this.class()),
    );
}

/** Every part of a select, for a component's `imports`. */
export const SELECT_PARTS = [
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
    SelectGroup,
    SelectLabel,
    SelectSeparator,
] as const;
