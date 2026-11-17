// Angular port of the Fragiola UI menu parts (examples/react/src/components/families/menu/parts.tsx):
// the parts a dropdown menu and a context menu share, with the `menu` and `popup` families'
// classes, over Angular CDK's menu directives (`CdkMenu`, `CdkMenuItem`, `CdkMenuItemRadio`,
// `CdkMenuGroup`) as host directives: roles, roving focus, arrow keys, typeahead, Enter and Space.
//
// What differs from the React one, and why:
//   - The content is the root element of an `<ng-template>` the trigger opens (`#/components/floating`
//     moves it into the body of the trigger's document):
//     the CDK menu runs inline in it, the kit owns the opening, the placement and the closing.
//   - Each part takes the selector of either menu (`kitDropdownMenuItem`, `kitContextMenuItem`),
//     so a template reads as its React twin (`DropdownMenu.Item`, `ContextMenu.Item`).
//   - An item's action is `(select)`; it closes the menu after it runs.
//   - Base UI marks state with `data-open`/`data-closed`/`data-disabled`/`data-checked`; the parts
//     add those attributes, so the families' variants apply unchanged.

import {
    CdkMenu,
    CdkMenuGroup,
    CdkMenuItem,
    CdkMenuItemRadio,
} from "@angular/cdk/menu";
import {
    booleanAttribute,
    Component,
    computed,
    DestroyRef,
    Directive,
    effect,
    inject,
    input,
    model,
    type OnInit,
} from "@angular/core";
import { LucideCheck } from "@lucide/angular";
import { type Align, POPUP, type Side } from "#/components/floating";
import { cn } from "#/lib/cn";
import { menu } from "../menu";
import { popup } from "../popup";

/** The menu's list: the root element of the template its trigger opens. */
@Directive({
    selector: "[kitDropdownMenuContent],[kitContextMenuContent]",
    hostDirectives: [CdkMenu],
    host: {
        "data-slot": "menu-content",
        "data-open": "",
        "[class]": "classes()",
    },
})
export class MenuContent implements OnInit {
    readonly class = input<string>();
    readonly side = input<Side>();
    readonly align = input<Align>();
    readonly sideOffset = input<number>();
    readonly alignOffset = input<number>();
    private readonly popup = inject(POPUP, { optional: true });
    private readonly menu = inject(CdkMenu);
    protected readonly classes = computed(() =>
        cn(
            popup.content("z-50 outline-none"),
            "max-h-(--available-height) origin-(--transform-origin) overflow-x-hidden overflow-y-auto",
            this.class(),
        ),
    );

    ngOnInit() {
        this.popup?.placement({
            side: this.side(),
            align: this.align(),
            sideOffset: this.sideOffset(),
            alignOffset: this.alignOffset(),
        });
        // the keyboard lands in the menu: arrows move from its first item
        queueMicrotask(() => this.menu.focusFirstItem("program"));
    }
}

/** Runs the item's action, then closes the menu (after the action: closing destroys the item). */
function closeAfterTrigger(item: CdkMenuItem) {
    const popupContext = inject(POPUP, { optional: true });
    const subscription = item.triggered.subscribe(() =>
        queueMicrotask(() => popupContext?.close()),
    );
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
}

/** An action. */
@Directive({
    selector: "[kitDropdownMenuItem],[kitContextMenuItem]",
    hostDirectives: [
        { directive: CdkMenuItem, outputs: ["cdkMenuItemTriggered: select"] },
    ],
    host: {
        "data-slot": "menu-item",
        "[attr.data-inset]": "inset() ? '' : null",
        "[attr.data-disabled]": "disabled() ? '' : null",
        "[class]": "classes()",
    },
})
export class MenuItem {
    readonly class = input<string>();
    readonly inset = input(false, { transform: booleanAttribute });
    readonly disabled = input(false, { transform: booleanAttribute });
    private readonly item = inject(CdkMenuItem);
    protected readonly classes = computed(() => cn(menu.item(), this.class()));

    constructor() {
        effect(() => {
            this.item.disabled = this.disabled();
        });
        closeAfterTrigger(this.item);
    }
}

/** The radio items' group: `value` is the checked item's, `(valueChange)` says which one was picked. */
@Directive({
    selector: "[kitDropdownMenuRadioGroup],[kitContextMenuRadioGroup]",
    hostDirectives: [CdkMenuGroup],
    host: { "data-slot": "menu-radio-group" },
})
export class MenuRadioGroup {
    readonly value = model<unknown>(undefined);
}

/** One choice of a radio group: the check sits in the indicator space on the end side. */
@Component({
    selector: "[kitDropdownMenuRadioItem],[kitContextMenuRadioItem]",
    imports: [LucideCheck],
    hostDirectives: [CdkMenuItemRadio],
    template: `
        <span data-slot="menu-item-indicator" [class]="indicator">
            @if (checked()) {
                <svg lucideCheck></svg>
            }
        </span>
        <ng-content />
    `,
    host: {
        "data-slot": "menu-item",
        "[attr.data-checked]": "checked() ? '' : null",
        "[attr.data-inset]": "inset() ? '' : null",
        "[attr.data-disabled]": "disabled() ? '' : null",
        "[class]": "classes()",
    },
})
export class MenuRadioItem {
    readonly kitDropdownMenuRadioItem = input<unknown>(undefined);
    readonly kitContextMenuRadioItem = input<unknown>(undefined);
    readonly class = input<string>();
    readonly inset = input(false, { transform: booleanAttribute });
    readonly disabled = input(false, { transform: booleanAttribute });
    private readonly group = inject(MenuRadioGroup);
    private readonly item = inject(CdkMenuItemRadio);
    private readonly ownValue = computed(
        () => this.kitDropdownMenuRadioItem() ?? this.kitContextMenuRadioItem(),
    );
    protected readonly checked = computed(
        () => this.group.value() === this.ownValue(),
    );
    protected readonly classes = computed(() =>
        cn(menu.selectableItem(), this.class()),
    );
    protected readonly indicator = menu.itemIndicator();

    constructor() {
        effect(() => {
            this.item.checked = this.checked();
            this.item.disabled = this.disabled();
        });
        const subscription = this.item.triggered.subscribe(() => {
            this.group.value.set(this.ownValue());
            // CDK toggles the item itself: keep it what the group says
            this.item.checked = this.checked();
        });
        inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
        closeAfterTrigger(this.item);
    }
}

/** A group of items (`role="group"`). */
@Directive({
    selector: "[kitDropdownMenuGroup],[kitContextMenuGroup]",
    hostDirectives: [CdkMenuGroup],
    host: { "data-slot": "menu-group" },
})
export class MenuGroup {}

/** A group's heading. */
@Directive({
    selector: "[kitDropdownMenuLabel],[kitContextMenuLabel]",
    host: {
        "data-slot": "menu-label",
        "[attr.data-inset]": "inset() ? '' : null",
        "[class]": "classes()",
    },
})
export class MenuLabel {
    readonly class = input<string>();
    readonly inset = input(false, { transform: booleanAttribute });
    protected readonly classes = computed(() => cn(menu.label(), this.class()));
}

/** A line between items. */
@Directive({
    selector: "[kitDropdownMenuSeparator],[kitContextMenuSeparator]",
    host: {
        role: "separator",
        "data-slot": "menu-separator",
        "[class]": "classes()",
    },
})
export class MenuSeparator {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(menu.separator(), this.class()),
    );
}

/** A shortcut hint at the end of an item. */
@Directive({
    selector: "[kitDropdownMenuShortcut],[kitContextMenuShortcut]",
    host: {
        "data-slot": "menu-shortcut",
        "[class]": "classes()",
    },
})
export class MenuShortcut {
    readonly class = input<string>();
    protected readonly classes = computed(() =>
        cn(menu.shortcut(), this.class()),
    );
}

/** Every part a menu template uses. */
export const MENU_PARTS = [
    MenuContent,
    MenuItem,
    MenuRadioGroup,
    MenuRadioItem,
    MenuGroup,
    MenuLabel,
    MenuSeparator,
    MenuShortcut,
] as const;
