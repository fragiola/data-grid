// Angular port of the Fragiola UI context menu (examples/react/src/components/ui/context-menu.tsx):
// the same parts, classes and palette roles, over Angular CDK's menu. The trigger is a directive on
// your own element (the element around a grid, where the React kit takes `render`), given the
// menu's template; a right-click opens it at the pointer, Shift+F10 or the context menu key at the
// element. The parts come from the menu family:
//
//     <div [kitContextMenuTrigger]="menu" #trigger="kitContextMenuTrigger" (openChange)="…">…</div>
//     <ng-template #menu>
//         <div kitContextMenuContent>
//             <div kitContextMenuItem [disabled]="!canDelete" (select)="remove()">Delete row</div>
//         </div>
//     </ng-template>
//
// What differs from the React one, and why:
//   - CDK's own `cdkContextMenuTriggerFor` opens in its overlay container; this one opens with the
//     kit's other popups (`#/components/floating`), in the body of the trigger's document.
//   - Base UI's `open` is controlled by the app through `onOpenChange`; here `(openChange)` says
//     when it opens or closes, and the app closes it (`close()`) when it should not be open, as a
//     right-click outside the body's cells. `openAt(point)` opens it at a point, for a long press
//     the app times itself. Closed, focus goes back to what had it; the app may move it after
//     (React's `finalFocus`), in `(openChange)`.

import { Directive, input, output, type TemplateRef } from "@angular/core";
import { MENU_PARTS } from "#/components/families/menu/parts";
import { injectPopup } from "#/components/floating";

/** Opens its menu where the element is right-clicked. */
@Directive({
    selector: "[kitContextMenuTrigger]",
    exportAs: "kitContextMenuTrigger",
    host: {
        "data-slot": "context-menu-trigger",
        "[attr.data-popup-open]": "popup.open() ? '' : null",
        "(contextmenu)": "onContextMenu($event)",
        "(keydown.shift.f10)": "openAtElement($event)",
        "(keydown.contextmenu)": "openAtElement($event)",
    },
})
export class ContextMenuTrigger {
    readonly kitContextMenuTrigger = input.required<TemplateRef<unknown>>();
    /** Says when the menu opens (`true`) or closes. */
    readonly openChange = output<boolean>();
    protected readonly popup = injectPopup((open) =>
        this.openChange.emit(open),
    );

    /** Whether the menu is open. */
    readonly open = this.popup.open;

    protected onContextMenu(event: MouseEvent) {
        event.preventDefault();
        this.openAt({ x: event.clientX, y: event.clientY });
    }

    /** Opens the menu at a point of the viewport (a long press's). */
    openAt(point: { x: number; y: number }) {
        this.popup.show(this.kitContextMenuTrigger(), {
            anchor: point,
            side: "bottom",
            align: "start",
            sideOffset: 0,
        });
    }

    /** Closes the menu. */
    close() {
        this.popup.hide();
    }

    protected openAtElement(event: Event) {
        event.preventDefault();
        this.popup.show(this.kitContextMenuTrigger(), {
            side: "bottom",
            align: "start",
        });
    }
}

/** The trigger and every part of a context menu, for a component's `imports`. */
export const CONTEXT_MENU = [ContextMenuTrigger, ...MENU_PARTS] as const;
