import {
    DestroyRef,
    ElementRef,
    type EmbeddedViewRef,
    InjectionToken,
    Injector,
    inject,
    type StaticProvider,
    signal,
    type TemplateRef,
    ViewContainerRef,
} from "@angular/core";

// Where the kit's popups (a select's list, a menu, a tooltip, a dialog) open: on top of the page,
// in the body of the document their trigger is in. Base UI portals a popup to the page's body and
// positions it with Floating UI; Angular CDK's overlay keeps one container in the main document
// (Dockable's Angular kit, where this comes from, moves tabs into popout windows). This opens a
// template's view next to
// its trigger, moves its nodes into the trigger's `ownerDocument.body` (read again on every open),
// positions it there, and closes it on Escape or a press outside, all in that document.

/** Which side of the anchor the popup sits on (`inline-*` follow the writing direction). */
export type Side =
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "inline-start"
    | "inline-end";

export type Align = "start" | "center" | "end";

export interface Placement {
    side?: Side;
    align?: Align;
    sideOffset?: number;
    alignOffset?: number;
}

/** What a popup is anchored to: an element, or a point (a context menu opens at the pointer). */
export type Anchor = HTMLElement | { x: number; y: number };

/** Why a popup closes by itself. */
export type DismissReason = "escape" | "outside";

export interface FloatingOptions extends Placement {
    /** The element the popup belongs to: its document hosts the popup, a press on it is inside. */
    owner: HTMLElement;
    anchor?: Anchor;
    /** The popup covers the page (a dialog's backdrop): nothing to position. */
    cover?: boolean;
    /** A press outside the popup and the owner, or Escape. */
    onDismiss?: (reason: DismissReason) => void;
}

/** What the content of an open popup reads: a way to close it, and where it is. */
export interface PopupContext {
    close(): void;
    /** The content's placement, read when the popup is positioned. */
    placement(value: Placement): void;
}

/** The open popup a content part is rendered in (the view's injector provides it). */
export const POPUP = new InjectionToken<PopupContext>("kit-popup");

const GUTTER = 8;

/** The open popups, last opened last: Escape closes only the top one. */
const stack: Floating[] = [];

/** One popup at a time, opened from a template next to its trigger. */
export class Floating {
    private view: EmbeddedViewRef<unknown> | undefined;
    private host: HTMLElement | undefined;
    private options: FloatingOptions | undefined;
    private placement: Placement = {};
    /** What had the focus when the popup opened: it gets it back when the popup closes. */
    private returnFocus: Element | null = null;
    private readonly cleanups: (() => void)[] = [];

    get isOpen() {
        return this.view !== undefined;
    }

    /** The popup's first element (the content part), while open. */
    get element(): HTMLElement | undefined {
        return this.host?.firstElementChild as HTMLElement | undefined;
    }

    /**
     * Renders `template` in `container` (so it is checked with the trigger's view), then moves its
     * nodes into a host at the end of the owner's document body and positions them.
     */
    open<C>(
        container: ViewContainerRef,
        template: TemplateRef<C>,
        context: C,
        injector: Injector,
        options: FloatingOptions,
    ) {
        this.close();
        this.options = options;
        this.placement = {};
        const doc = options.owner.ownerDocument;
        this.returnFocus = doc.activeElement;
        const view = container.createEmbeddedView(template, context, {
            injector,
        });
        this.view = view;
        const host = doc.createElement("div");
        host.setAttribute("data-kit-floating", "");
        host.style.position = "fixed";
        host.style.zIndex = "50";
        if (options.cover) {
            host.style.inset = "0";
        } else {
            host.style.left = "0";
            host.style.top = "0";
            // measured before it is placed: keep it from flashing at the corner
            host.style.visibility = "hidden";
        }
        this.host = host;
        for (const node of view.rootNodes as Node[]) host.appendChild(node);
        doc.body.appendChild(host);
        view.detectChanges();
        this.listen(doc);
        this.position();
    }

    /** The content's own placement (`side`, `align`, …), applied on the next positioning. */
    setPlacement(value: Placement) {
        this.placement = { ...this.placement, ...value };
    }

    /** Places the popup again (after a change of content or anchor). */
    position() {
        const host = this.host;
        const options = this.options;
        const element = this.element;
        if (!host || !options || options.cover || !element) return;
        const win = host.ownerDocument.defaultView;
        if (!win) return;
        const { side = "bottom", align = "start" } = {
            ...options,
            ...this.placement,
        };
        const sideOffset = this.placement.sideOffset ?? options.sideOffset ?? 4;
        const alignOffset =
            this.placement.alignOffset ?? options.alignOffset ?? 0;
        const rtl = win.getComputedStyle(options.owner).direction === "rtl";
        const anchor = options.anchor ?? options.owner;
        const rect =
            "x" in anchor
                ? {
                      left: anchor.x,
                      right: anchor.x,
                      top: anchor.y,
                      bottom: anchor.y,
                      width: 0,
                      height: 0,
                  }
                : anchor.getBoundingClientRect();
        const width = win.innerWidth;
        const height = win.innerHeight;

        let physical: "top" | "bottom" | "left" | "right" =
            side === "inline-start"
                ? rtl
                    ? "right"
                    : "left"
                : side === "inline-end"
                  ? rtl
                      ? "left"
                      : "right"
                  : side;
        const vertical = physical === "top" || physical === "bottom";

        // the room on the chosen side bounds the popup's height (`max-h-(--available-height)`)
        const room = (which: typeof physical) =>
            which === "bottom"
                ? height - rect.bottom - sideOffset - GUTTER
                : which === "top"
                  ? rect.top - sideOffset - GUTTER
                  : height - 2 * GUTTER;
        // its natural height first (bounded by the viewport only), to choose the side
        element.style.setProperty(
            "--available-height",
            `${height - 2 * GUTTER}px`,
        );
        if (vertical) {
            // flip to the other side when it does not fit and the other side has more room
            const natural = element.getBoundingClientRect().height;
            const other = physical === "bottom" ? "top" : "bottom";
            if (natural > room(physical) && room(other) > room(physical)) {
                physical = other;
            }
        }
        element.style.setProperty("--available-height", `${room(physical)}px`);
        const box = element.getBoundingClientRect();

        let left: number;
        let top: number;
        if (vertical) {
            top =
                physical === "bottom"
                    ? rect.bottom + sideOffset
                    : rect.top - sideOffset - box.height;
            const start = rtl ? rect.right - box.width : rect.left;
            const end = rtl ? rect.left : rect.right - box.width;
            left =
                align === "center"
                    ? rect.left + (rect.width - box.width) / 2
                    : align === "end"
                      ? end
                      : start;
            left += rtl ? -alignOffset : alignOffset;
        } else {
            left =
                physical === "right"
                    ? rect.right + sideOffset
                    : rect.left - sideOffset - box.width;
            top =
                align === "center"
                    ? rect.top + (rect.height - box.height) / 2
                    : align === "end"
                      ? rect.bottom - box.height
                      : rect.top;
            top += alignOffset;
        }
        left = Math.max(GUTTER, Math.min(left, width - box.width - GUTTER));
        top = Math.max(GUTTER, Math.min(top, height - box.height - GUTTER));
        host.style.left = `${Math.round(left)}px`;
        host.style.top = `${Math.round(top)}px`;
        host.style.visibility = "";
        element.setAttribute("data-side", physical);
        element.style.setProperty(
            "--transform-origin",
            vertical
                ? `${rect.left + rect.width / 2 - left}px ${physical === "bottom" ? 0 : box.height}px`
                : `${physical === "right" ? 0 : box.width}px ${rect.top + rect.height / 2 - top}px`,
        );
    }

    /**
     * Destroys the view and removes the host; a focus inside goes back to what had it when the
     * popup opened (else to the owner).
     */
    close() {
        const view = this.view;
        const host = this.host;
        const owner = this.options?.owner;
        const previous = this.returnFocus;
        this.view = undefined;
        this.host = undefined;
        this.options = undefined;
        this.returnFocus = null;
        for (const cleanup of this.cleanups.splice(0)) cleanup();
        if (!view || !host) return;
        const focused = host.contains(host.ownerDocument.activeElement);
        if (!view.destroyed) view.destroy();
        host.remove();
        if (!focused) return;
        for (const target of [previous, owner]) {
            if (
                target?.isConnected &&
                target !== target.ownerDocument.body &&
                typeof (target as HTMLElement).focus === "function"
            ) {
                (target as HTMLElement).focus({ preventScroll: true });
                return;
            }
        }
    }

    private listen(doc: Document) {
        const win = doc.defaultView;
        const dismiss = (reason: DismissReason) =>
            this.options?.onDismiss?.(reason);
        const outside = (target: Node | null) =>
            target !== null &&
            !this.host?.contains(target) &&
            !this.options?.owner.contains(target);
        const onPointerDown = (event: PointerEvent) => {
            if (outside(event.target as Node | null)) dismiss("outside");
        };
        // the focus left (Tab past the popup, a click elsewhere): Base UI closes then too
        const onFocusIn = (event: FocusEvent) => {
            if (outside(event.target as Node | null)) dismiss("outside");
        };
        const onKeyDown = (event: KeyboardEvent) => {
            const top = stack
                .filter((popup) => popup.host?.ownerDocument === doc)
                .at(-1);
            if (event.key === "Escape" && top === this) {
                dismiss("escape");
            }
        };
        const onMove = () => this.position();
        stack.push(this);
        doc.addEventListener("pointerdown", onPointerDown, true);
        doc.addEventListener("focusin", onFocusIn);
        doc.addEventListener("keydown", onKeyDown);
        win?.addEventListener("resize", onMove);
        win?.addEventListener("scroll", onMove, true);
        this.cleanups.push(() => {
            stack.splice(stack.indexOf(this), 1);
            doc.removeEventListener("pointerdown", onPointerDown, true);
            doc.removeEventListener("focusin", onFocusIn);
            doc.removeEventListener("keydown", onKeyDown);
            win?.removeEventListener("resize", onMove);
            win?.removeEventListener("scroll", onMove, true);
        });
    }
}

/**
 * A popup opened by the element of the calling directive (its trigger): `show` renders a template
 * in a popup owned by that element, `hide` closes it, `open` says whether it is open. The
 * template's content parts read the popup (`POPUP`, and `providers`) to close it and give their
 * placement. Call in a directive's injection context.
 */
export function injectPopup(
    onOpenChange?: (open: boolean) => void,
    providers: StaticProvider[] = [],
) {
    const container = inject(ViewContainerRef);
    const parent = inject(Injector);
    const owner: HTMLElement = inject(ElementRef).nativeElement;
    const floating = new Floating();
    const open = signal(false);

    function hide() {
        if (!floating.isOpen) return;
        floating.close();
        open.set(false);
        onOpenChange?.(false);
    }

    const context: PopupContext = {
        close: hide,
        placement: (value) => floating.setPlacement(value),
    };
    const injector = Injector.create({
        providers: [{ provide: POPUP, useValue: context }, ...providers],
        parent,
    });

    function show(
        template: TemplateRef<unknown>,
        options: Omit<FloatingOptions, "owner"> = {},
    ) {
        hide();
        // said before the content renders: a content that reads state when it opens is current
        open.set(true);
        onOpenChange?.(true);
        floating.open(container, template, undefined, injector, {
            owner,
            onDismiss: hide,
            ...options,
        });
    }

    inject(DestroyRef).onDestroy(() => floating.close());
    return { open: open.asReadonly(), show, hide, floating, owner };
}
