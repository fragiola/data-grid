// Scroll scaling: a scroll space larger than the browser allows.
//
// A browser caps an element's size (about 33.5M px in Chromium and WebKit, about 17.9M px in
// Firefox), so 100M rows of 32 px cannot be laid out as one tall element. When an axis's virtual
// size passes a cap, the scroll container is given a physical size at the cap instead, and the
// engine maps between the two:
//
// - **Jumps are proportional.** A native scroll the engine did not cause (the thumb dragged, a
//   touch fling, the scrollbar's track clicked) lands at the same fraction of the virtual size as
//   of the physical one, so the ends of the scrollbar are the ends of the dataset.
// - **Moves are exact.** The engine moves the virtual offset itself for the wheel and the keyboard
//   (`ScrollAxisState.scrollBy`/`scrollTo`): the content moves by exactly the delta, and the
//   physical scroll is then set to the proportional position of the new offset, so the thumb
//   follows. The scroll event that follows lands where the engine put it, and is recognised as its
//   own (`sync`) instead of being mapped back (which would round to a whole physical pixel, many
//   virtual pixels apart).
//
// The rendered layer is translated by `physical - virtual` (plus the rendered rows' base), so
// what is on screen is the virtual offset's content wherever the physical scroll stands. Without
// scaling (the virtual size fits), every mapping is the identity and the native scroll is left
// alone.
//
// **Whole pixels (Epic #89).** A browser takes a fractional scroll its own way (Chromium rounds
// it, WebKit drops the fraction), so the physical scroll the engine writes is always whole, and
// the axis holds exactly what it writes: the physical size is rounded up (its end reachable), and
// without scaling the virtual offset is the physical scroll, whole too, its end rounded up (the
// content's end in view); a wheel's fractions add up until they make a pixel.

/** The default cap on an axis's physical size: below every browser's maximum element size. */
export const DEFAULT_MAX_SCROLL_SIZE = 10_000_000;

/** How the virtual offsets of one axis map onto its physical scroll. */
export interface ScrollMapping {
    /** the content's size: what the scrollbar represents */
    readonly virtualSize: number;
    /** the size of the area the content scrolls in */
    readonly viewportSize: number;
    /** the size the scroll container lays out: the virtual size, or the cap */
    readonly physicalSize: number;
    /** whether the physical size is smaller than the virtual one */
    readonly scaled: boolean;
    /** the largest virtual offset (the content's end at the viewport's end) */
    readonly maxVirtual: number;
    /** the largest physical scroll */
    readonly maxPhysical: number;
    /** the virtual offset a physical scroll stands for (proportional, ends exact) */
    toVirtual(physical: number): number;
    /** the physical scroll that stands for a virtual offset (proportional, ends exact) */
    toPhysical(virtual: number): number;
}

function clamp(value: number, max: number): number {
    return Math.min(Math.max(value, 0), Math.max(max, 0));
}

/** The mapping of an axis whose content is `virtualSize` long, seen through `viewportSize`. */
export function createScrollMapping(
    virtualSize: number,
    viewportSize: number,
    maxScrollSize: number = DEFAULT_MAX_SCROLL_SIZE,
): ScrollMapping {
    const viewport = Math.max(0, viewportSize);
    // never smaller than the viewport, or nothing would scroll at all
    const cap = Math.max(maxScrollSize, viewport * 2);
    // whole pixels: the end of a fractional size (measured rows) is reached
    const physicalSize = Math.ceil(Math.min(Math.max(0, virtualSize), cap));
    const maxPhysical = Math.max(0, Math.ceil(physicalSize - viewport));
    const scaled = physicalSize < virtualSize && maxPhysical > 0;
    // unscaled, the virtual offset is the physical scroll: its end the same whole pixel (the
    // content's fraction left in view); scaled, the content's own end, exactly
    const maxVirtual = scaled
        ? Math.max(0, virtualSize - viewport)
        : maxPhysical;
    const ratio = scaled ? maxVirtual / maxPhysical : 1;
    return {
        virtualSize: Math.max(0, virtualSize),
        viewportSize: viewport,
        physicalSize,
        scaled,
        maxVirtual,
        maxPhysical,
        toVirtual: (physical) => {
            if (!scaled) return clamp(physical, maxVirtual);
            if (physical >= maxPhysical) return maxVirtual;
            return clamp(physical * ratio, maxVirtual);
        },
        // whole pixels: what the engine writes
        toPhysical: (virtual) => {
            if (!scaled) return Math.round(clamp(virtual, maxPhysical));
            if (virtual >= maxVirtual) return maxPhysical;
            return Math.round(clamp(virtual / ratio, maxPhysical));
        },
    };
}

/** Whether two mappings lay an axis out alike (the rest of a mapping follows from these). */
export function sameMapping(a: ScrollMapping, b: ScrollMapping): boolean {
    return (
        a.virtualSize === b.virtualSize &&
        a.viewportSize === b.viewportSize &&
        a.physicalSize === b.physicalSize
    );
}

/**
 * The scroll position of one axis: the virtual offset the grid shows, kept exact through the moves
 * the engine makes, and remapped from the physical scroll on the moves it did not make.
 */
export class ScrollAxisState {
    /** the virtual offset in view */
    virtual = 0;
    /** the physical scroll the engine last asked for, while it is the one in place */
    private expected: number | null = null;
    /** unscaled, what moves by a delta (the wheel) left short of a whole pixel, for the next */
    private remainder = 0;

    constructor(public mapping: ScrollMapping) {}

    /**
     * Reads the physical scroll the container reports. Where the engine put it, the exact virtual
     * offset stays; anywhere else (a jump the engine did not make) it is mapped proportionally.
     * Returns whether the virtual offset changed.
     */
    sync(physical: number): boolean {
        const before = this.virtual;
        if (!this.mapping.scaled) {
            // the identity: the native scroll is the truth, to the sub-pixel
            this.expected = null;
            this.virtual = this.mapping.toVirtual(physical);
        } else if (
            this.expected === null ||
            Math.abs(physical - this.expected) > 1
        ) {
            this.expected = null;
            this.virtual = this.mapping.toVirtual(physical);
        }
        // a scroll the engine did not make: a delta's fraction is no longer the next move's
        if (this.virtual !== before) this.remainder = 0;
        return this.virtual !== before;
    }

    /**
     * The virtual offset a move to `virtual` holds: within the axis, and unscaled a whole pixel
     * (the physical scroll). A move to where the axis is already is no move.
     */
    offsetFor(virtual: number): number {
        const offset = clamp(virtual, this.mapping.maxVirtual);
        return this.mapping.scaled ? offset : Math.round(offset);
    }

    /**
     * Whether a move to `virtual` moves the axis: by a pixel or more. A scroll at a fractional
     * offset (a page zoomed, a fractional device pixel ratio) is where a move to its whole pixel
     * would put it: no move.
     */
    moves(virtual: number): boolean {
        return Math.abs(this.offsetFor(virtual) - this.virtual) >= 1;
    }

    /** Moves to a virtual offset (`offsetFor`). Returns the physical scroll to set on the container. */
    scrollTo(virtual: number): number {
        this.remainder = 0;
        return this.moveTo(virtual);
    }

    /**
     * Moves by a virtual delta (the wheel), exactly when scaled; unscaled, by whole pixels, the
     * fraction kept for the next delta (a trackpad's sub-pixel deltas add up). Returns the physical
     * scroll to set on the container.
     */
    scrollBy(delta: number): number {
        const target = this.virtual + this.remainder + delta;
        const physical = this.moveTo(target);
        this.remainder = this.mapping.scaled
            ? 0
            : clamp(target, this.mapping.maxVirtual) - this.virtual;
        return physical;
    }

    private moveTo(virtual: number): number {
        this.virtual = this.offsetFor(virtual);
        const physical = this.mapping.toPhysical(this.virtual);
        this.expected = physical;
        return physical;
    }

    /** Takes a new mapping (the content or the viewport changed), keeping the virtual offset. */
    remap(mapping: ScrollMapping): number {
        this.mapping = mapping;
        return this.scrollTo(this.virtual);
    }

    /**
     * The translation of a layer whose items are laid out from virtual offset `base`, for the
     * container scrolled to `physical`: the item at virtual offset `y` (at `y - base` in the layer)
     * shows at `y - virtual` in the viewport.
     */
    layerOffset(base: number, physical: number): number {
        return physical - this.virtual + base;
    }
}
