// One axis of the grid: its items (rows or columns), their sizes and offsets. Pure math, no DOM.
//
// A fixed size answers every question in O(1) and allocates nothing, whatever the count (100M rows
// cost nothing). A size per index keeps one Float64Array of prefix sums (offsets[i] is where item i
// starts, offsets[count] the total), built once and searched in O(log n); growing the count
// (infinite loading) extends it instead of rebuilding it.

/** An item's size in pixels: one for all, or one per index. Negative and non-finite sizes count as 0. */
export type Size = number | ((index: number) => number);

/** The sizes and offsets of a run of items (the rows, or the columns), in virtual pixels. */
export interface Axis {
    /** how many items */
    readonly count: number;
    /** the sum of every item's size */
    readonly totalSize: number;
    /** whether every item has the same size */
    readonly fixed: boolean;
    /** where item `index` starts; `offsetOf(count)` is the total size. The index is clamped. */
    offsetOf(index: number): number;
    /** item `index`'s size (0 outside the axis) */
    sizeOf(index: number): number;
    /**
     * The item covering `offset`: the first whose end is past it. Clamped: an offset before the
     * start is item 0, one at or past the end the last item. -1 when there are no items.
     */
    indexAt(offset: number): number;
    /** The same sizes over `count` items; offsets already computed are kept. */
    withCount(count: number): Axis;
    /** The same axis after the sizes of the items from `index` on changed (a size function's answer). */
    resized(index: number): Axis;
}

function clean(size: number): number {
    return Number.isFinite(size) && size > 0 ? size : 0;
}

function cleanCount(count: number): number {
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

/** Creates an axis of `count` items of `size` pixels each, or `size(index)` pixels for item `index`. */
export function createAxis(count: number, size: Size): Axis {
    return typeof size === "number"
        ? new FixedAxis(cleanCount(count), clean(size))
        : VariableAxis.build(cleanCount(count), size);
}

class FixedAxis implements Axis {
    readonly fixed = true;
    readonly totalSize: number;

    constructor(
        readonly count: number,
        private readonly size: number,
    ) {
        this.totalSize = count * size;
    }

    offsetOf(index: number): number {
        return Math.min(Math.max(index, 0), this.count) * this.size;
    }

    sizeOf(index: number): number {
        return index >= 0 && index < this.count ? this.size : 0;
    }

    indexAt(offset: number): number {
        if (this.count === 0) return -1;
        if (this.size === 0) return 0;
        return Math.min(
            Math.max(Math.floor(offset / this.size), 0),
            this.count - 1,
        );
    }

    withCount(count: number): Axis {
        return new FixedAxis(cleanCount(count), this.size);
    }

    resized(): Axis {
        return this;
    }
}

class VariableAxis implements Axis {
    readonly fixed = false;

    private constructor(
        readonly count: number,
        private readonly size: (index: number) => number,
        /** offsets[0..count] are valid; the buffer may be longer (room to grow) */
        private readonly offsets: Float64Array,
        /**
         * Whether this axis may write past its count into `offsets` (to grow without copying).
         * One axis at a time owns a buffer's tail: growing hands it to the grown axis, and a
         * shrunk axis never gets it, so no axis overwrites offsets another still reads.
         */
        private owner: boolean,
    ) {}

    /** An axis of `count` items, reusing the first `valid + 1` offsets of `from` (when given). */
    static build(
        count: number,
        size: (index: number) => number,
        from?: Float64Array,
        valid = 0,
        inPlace = false,
    ): VariableAxis {
        let offsets: Float64Array;
        if (from && inPlace && from.length > count) {
            offsets = from;
        } else {
            // room to grow: infinite loading appends often, so the buffer doubles
            offsets = new Float64Array(
                from ? Math.max(count + 1, from.length * 2) : count + 1,
            );
            if (from) offsets.set(from.subarray(0, valid + 1));
        }
        const start = from ? Math.min(valid, count) : 0;
        let total = offsets[start] ?? 0;
        for (let i = start; i < count; i++) {
            total += clean(size(i));
            offsets[i + 1] = total;
        }
        return new VariableAxis(count, size, offsets, true);
    }

    get totalSize(): number {
        return this.offsets[this.count] ?? 0;
    }

    private clampIndex(index: number): number {
        return Number.isNaN(index)
            ? 0
            : Math.min(Math.max(Math.floor(index), 0), this.count);
    }

    offsetOf(index: number): number {
        return this.offsets[this.clampIndex(index)] ?? 0;
    }

    sizeOf(index: number): number {
        if (!(index >= 0 && index < this.count)) return 0;
        const item = Math.floor(index);
        return (this.offsets[item + 1] ?? 0) - (this.offsets[item] ?? 0);
    }

    indexAt(offset: number): number {
        if (this.count === 0) return -1;
        // the first item whose end (offsets[i + 1]) is past the offset
        let low = 0;
        let high = this.count - 1;
        while (low < high) {
            const middle = (low + high) >>> 1;
            if ((this.offsets[middle + 1] ?? 0) > offset) {
                high = middle;
            } else {
                low = middle + 1;
            }
        }
        return low;
    }

    withCount(count: number): Axis {
        const next = cleanCount(count);
        if (next === this.count) return this;
        if (next < this.count) {
            // the prefix is still right: share it, read-only (no item before `next` changed)
            return new VariableAxis(next, this.size, this.offsets, false);
        }
        // the owner grows in place (it writes past its own count only) and hands the tail over;
        // any other axis copies first
        const inPlace = this.owner;
        this.owner = false;
        return VariableAxis.build(
            next,
            this.size,
            this.offsets,
            this.count,
            inPlace,
        );
    }

    resized(index: number): Axis {
        // a fresh buffer: this axis stays valid for whoever still holds it
        return VariableAxis.build(
            this.count,
            this.size,
            this.offsets.subarray(0, this.count + 1),
            this.clampIndex(index),
        );
    }
}
