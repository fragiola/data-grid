// Angular port of the Fragiola UI tooltip (examples/react/src/components/ui/tooltip.tsx): the same
// parts, classes and palette roles (`popup.tooltip`). Angular Aria and CDK have no tooltip (CDK's
// overlay is what Material's is built on), so this is the WAI-ARIA tooltip pattern on the kit's
// popup: a directive on your own element (a button, a cell: where the React kit takes `render`), given the tooltip's template, whose root element is the content:
//
//     <button [kitTooltipTrigger]="tip" aria-label="Locked">…</button>
//     <ng-template #tip><div kitTooltipContent>Only incident tabs can be dropped here</div></ng-template>
//
// Hover opens it after Base UI's delay (600 ms), keyboard focus at once; leaving, blur, a press and
// Escape close it. Moving to another trigger soon after one closed skips the delay, as Base UI's
// provider does (here for every tooltip of the page, so there is no provider part).

import {
    computed,
    DestroyRef,
    Directive,
    ElementRef,
    inject,
    input,
    type OnInit,
    type TemplateRef,
} from "@angular/core";
import { popup } from "#/components/families/popup";
import {
    type Align,
    injectPopup,
    POPUP,
    type Side,
} from "#/components/floating";
import { cn } from "#/lib/cn";

/** Base UI's default delay before a tooltip opens. */
const DELAY = 600;
/** How long after a tooltip closed another one opens without the delay. */
const GROUP_TIMEOUT = 400;

let lastClosed = 0;

@Directive({
    selector: "[kitTooltipTrigger]",
    exportAs: "kitTooltipTrigger",
    host: {
        "data-slot": "tooltip-trigger",
        "[attr.data-popup-open]": "popup.open() ? '' : null",
        "(pointerenter)": "onEnter($event)",
        "(pointerleave)": "close()",
        "(pointerdown)": "close()",
        "(focusin)": "onFocus()",
        "(focusout)": "close()",
    },
})
export class TooltipTrigger {
    readonly kitTooltipTrigger = input.required<TemplateRef<unknown>>();
    readonly delay = input(DELAY);
    protected readonly popup = injectPopup((open) => {
        if (!open) lastClosed = Date.now();
    });
    private timer: ReturnType<typeof setTimeout> | undefined;

    constructor() {
        inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
    }

    protected onEnter(event: PointerEvent) {
        if (event.pointerType === "touch" || this.popup.open()) return;
        clearTimeout(this.timer);
        const instant = Date.now() - lastClosed < GROUP_TIMEOUT;
        if (instant) {
            this.show();
        } else {
            this.timer = setTimeout(() => this.show(), this.delay());
        }
    }

    protected onFocus() {
        const element = this.popup.owner;
        // a focus the pointer gave (a click) does not open it: the keyboard's does
        if (
            !element.matches(":focus-visible") &&
            !element.querySelector(":focus-visible")
        ) {
            return;
        }
        this.show();
    }

    private show() {
        clearTimeout(this.timer);
        if (!this.popup.open()) {
            this.popup.show(this.kitTooltipTrigger(), { side: "top" });
        }
    }

    close() {
        clearTimeout(this.timer);
        this.popup.hide();
    }
}

/** The tooltip's box: the root element of the trigger's template. */
@Directive({
    selector: "[kitTooltipContent]",
    host: {
        role: "tooltip",
        "data-slot": "tooltip-content",
        "data-open": "",
        "[class]": "classes()",
    },
})
export class TooltipContent implements OnInit {
    readonly class = input<string>();
    // the positioner's placement, as Popover and the menus' content take it (React's)
    readonly side = input<Side>("top");
    readonly align = input<Align>();
    readonly sideOffset = input(4);
    readonly alignOffset = input<number>();
    private readonly popup = inject(POPUP, { optional: true });
    private readonly element: HTMLElement = inject(ElementRef).nativeElement;
    protected readonly classes = computed(() =>
        cn(popup.tooltip(), this.class()),
    );

    ngOnInit() {
        this.popup?.placement({
            side: this.side(),
            align: this.align(),
            sideOffset: this.sideOffset(),
            alignOffset: this.alignOffset(),
        });
        // Base UI's entry transition: the starting style for one frame, then the tooltip fades in
        const view = this.element.ownerDocument.defaultView;
        this.element.setAttribute("data-starting-style", "");
        view?.requestAnimationFrame(() =>
            view.requestAnimationFrame(() =>
                this.element.removeAttribute("data-starting-style"),
            ),
        );
    }
}

/** Both parts of a tooltip, for a component's `imports`. */
export const TOOLTIP = [TooltipTrigger, TooltipContent] as const;
