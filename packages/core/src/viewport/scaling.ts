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
    const physicalSize = Math.min(Math.max(0, virtualSize), cap);
    const maxVirtual = Math.max(0, virtualSize - viewport);
    const maxPhysical = Math.max(0, physicalSize - viewport);
    const scaled = physicalSize < virtualSize && maxPhysical > 0;
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
        toPhysical: (virtual) => {
            if (!scaled) return clamp(virtual, maxPhysical);
            if (virtual >= maxVirtual) return maxPhysical;
            return clamp(virtual / ratio, maxPhysical);
        },
    };
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
        return this.virtual !== before;
    }

    /** Moves to an exact virtual offset. Returns the physical scroll to set on the container. */
    scrollTo(virtual: number): number {
        this.virtual = clamp(virtual, this.mapping.maxVirtual);
        const physical = this.mapping.toPhysical(this.virtual);
        this.expected = physical;
        return physical;
    }

    /** Moves by an exact virtual delta. Returns the physical scroll to set on the container. */
    scrollBy(delta: number): number {
        return this.scrollTo(this.virtual + delta);
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
