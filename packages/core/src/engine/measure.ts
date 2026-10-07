import { type Axis, clampedIndex, cleanCount } from "../axis/axis";
import type { RowKey } from "../model/types";
import { lowerBound } from "../utils";

// Measured heights (Epic #86, E2.2): what an engine read of the rows and details it rendered, by
// row index, each with the key of the row it was read for. A height stays while its key is at its
// index: scrolled away and back, a row keeps it; a new source or `rows.changed` keeps each one
// whose row is still there and drops the others (`keep`). The row axis takes them over the
// estimate (`axis`).
//
// They are kept in sorted blocks of a few dozen, each never changed once made, with the heights
// and counts before every block: a batch of m heights makes its few blocks again and the list of
// blocks (O(m log k + m·B + k/B)), never the whole store, and an axis over a version answers in
// O(log k) with nothing to build. Old versions stay valid: a view holding an axis keeps its
// offsets.

/** A height read for the row at `index`, whose key is `key`. */
export interface Measure {
    readonly index: number;
    readonly height: number;
    readonly key: RowKey;
}

/** What an engine calls of the observer it creates from its viewport's window. */
export interface HeightObserver {
    observe(target: Element): void;
    unobserve(target: Element): void;
    disconnect(): void;
}

/** Heights in a block once one is split: a block holds up to twice as many. */
const BLOCK = 64;

/** Measured heights, ascending by index, and their sums before each. Never changed once made. */
interface Block {
    readonly indexes: readonly number[];
    readonly heights: readonly number[];
    readonly keys: readonly RowKey[];
    /** `before[j]`: the sum of the first `j` heights (`before[length]`, all of them) */
    readonly before: Float64Array;
}

/** A version of the heights: its blocks, and what comes before each. Never changed once made. */
interface Blocks {
    readonly blocks: readonly Block[];
    /** `heightsBefore[b]`, `countBefore[b]`: the heights in the blocks before block `b` */
    readonly heightsBefore: Float64Array;
    readonly countBefore: Float64Array;
}

function blockOf(entries: readonly Measure[]): Block {
    const before = new Float64Array(entries.length + 1);
    entries.forEach((entry, j) => {
        before[j + 1] = (before[j] ?? 0) + entry.height;
    });
    return {
        indexes: entries.map((entry) => entry.index),
        heights: entries.map((entry) => entry.height),
        keys: entries.map((entry) => entry.key),
        before,
    };
}

/** The entries of a block, `BLOCK` a block when they are too many for one. */
function blocksOf(entries: readonly Measure[]): Block[] {
    if (entries.length <= 2 * BLOCK) return [blockOf(entries)];
    const blocks: Block[] = [];
    for (let at = 0; at < entries.length; at += BLOCK) {
        blocks.push(blockOf(entries.slice(at, at + BLOCK)));
    }
    return blocks;
}

function versionOf(blocks: readonly Block[]): Blocks {
    const heightsBefore = new Float64Array(blocks.length + 1);
    const countBefore = new Float64Array(blocks.length + 1);
    blocks.forEach((block, b) => {
        heightsBefore[b + 1] =
            (heightsBefore[b] ?? 0) + (block.before[block.indexes.length] ?? 0);
        countBefore[b + 1] = (countBefore[b] ?? 0) + block.indexes.length;
    });
    return { blocks, heightsBefore, countBefore };
}

const EMPTY = versionOf([]);
const NO_INDEXES: readonly number[] = [];

// What the searches below look for, set before each one (they never nest): `lowerBound` is given
// the same predicates every time, so a lookup allocates nothing.
let sought = 0;
let soughtBlocks: readonly Block[] = [];
let soughtIndexes: readonly number[] = [];
let soughtVersion = EMPTY;
let soughtEstimate = 0;
let soughtBlock = 0;

const blockStartsBy = (b: number) =>
    (soughtBlocks[b]?.indexes[0] ?? 0) <= sought;
const indexBelow = (j: number) => (soughtIndexes[j] ?? 0) < sought;
const blockOffsetBy = (b: number) =>
    startOf(
        soughtVersion,
        soughtEstimate,
        b,
        0,
        soughtVersion.blocks[b]?.indexes[0] ?? 0,
    ) <= sought;
const entryOffsetBy = (j: number) =>
    startOf(
        soughtVersion,
        soughtEstimate,
        soughtBlock,
        j,
        soughtVersion.blocks[soughtBlock]?.indexes[j] ?? 0,
    ) <= sought;

/** The block an index belongs in: the last one starting at or before it (the first for none). */
function blockAt({ blocks }: Blocks, index: number): number {
    soughtBlocks = blocks;
    sought = index;
    return Math.max(0, lowerBound(blocks.length, blockStartsBy) - 1);
}

/** Where `index` is, or would go, in a block. */
function entryAt(block: Block, index: number): number {
    soughtIndexes = block.indexes;
    sought = index;
    return lowerBound(block.indexes.length, indexBelow);
}

/**
 * Where an item at `index` starts when `j` heights of block `b` (and every block before it) come
 * before it: its index's estimate, plus what they add over theirs.
 */
function startOf(
    { blocks, heightsBefore, countBefore }: Blocks,
    estimate: number,
    b: number,
    j: number,
    index: number,
): number {
    const before = (heightsBefore[b] ?? 0) + (blocks[b]?.before[j] ?? 0);
    const count = (countBefore[b] ?? 0) + j;
    return index * estimate + before - count * estimate;
}

/** The entries of a block, as measures (the ones a batch merges with it). */
function entriesOf(block: Block | undefined): Measure[] {
    return block
        ? block.indexes.map((index, j) => ({
              index,
              height: block.heights[j] ?? 0,
              key: block.keys[j] ?? 0,
          }))
        : [];
}

/** The heights measured for rows (or for their details), by row index. */
export class MeasuredHeights {
    private current: Blocks = EMPTY;
    /** the last axis built, and what it was built for */
    private built: {
        version: Blocks;
        count: number;
        estimate: number;
        axis: Axis;
    } | null = null;

    /** Whether `index` holds `height`, measured for `key` (nothing to take in). */
    holds(index: number, height: number, key: RowKey): boolean {
        const block = this.current.blocks[blockAt(this.current, index)];
        if (!block) return false;
        const j = entryAt(block, index);
        return (
            block.indexes[j] === index &&
            block.heights[j] === height &&
            block.keys[j] === key
        );
    }

    /** The height measured at `index`, or `undefined`. */
    heightAt(index: number): number | undefined {
        const block = this.current.blocks[blockAt(this.current, index)];
        if (!block) return undefined;
        const j = entryAt(block, index);
        return block.indexes[j] === index ? block.heights[j] : undefined;
    }

    /**
     * Takes heights in, a later one for an index over an earlier; returns the indexes whose
     * height changed (a new index, a new height, a new key), ascending. Only the blocks they fall
     * in are made again.
     */
    set(measures: readonly Measure[]): readonly number[] {
        // by index, once each: for one measured twice, the last
        const sorted = [...measures]
            .sort((a, b) => a.index - b.index)
            .filter(
                (measure, m, all) =>
                    all[m + 1]?.index !== measure.index &&
                    !this.holds(measure.index, measure.height, measure.key),
            );
        if (sorted.length === 0) return NO_INDEXES;
        const blocks = this.current.blocks;
        const next: Block[] = [];
        let at = 0;
        // each block with what falls in it (the first takes what comes before every block)
        for (let b = 0; b < Math.max(blocks.length, 1); b++) {
            const start = at;
            const bound = blocks[b + 1]?.indexes[0] ?? Number.POSITIVE_INFINITY;
            while (at < sorted.length && (sorted[at]?.index ?? 0) < bound) {
                at += 1;
            }
            const block = blocks[b];
            if (at === start && block) {
                next.push(block);
                continue;
            }
            const merged = entriesOf(block);
            for (let m = start; m < at; m++) {
                const measure = sorted[m];
                if (!measure) continue;
                const j = lowerBound(
                    merged.length,
                    (i) => (merged[i]?.index ?? 0) < measure.index,
                );
                merged.splice(
                    j,
                    merged[j]?.index === measure.index ? 1 : 0,
                    measure,
                );
            }
            next.push(...blocksOf(merged));
        }
        this.replace(next);
        return sorted.map((measure) => measure.index);
    }

    /**
     * Keeps the heights from `start` to `end` (excluded) whose index still holds their row
     * (`keyAt`: the key of the row there, `undefined` while none is loaded); returns whether one
     * was dropped. Only the blocks that lose one are made again.
     */
    keep(
        start: number,
        end: number,
        keyAt: (index: number) => RowKey | undefined,
    ): boolean {
        const { blocks } = this.current;
        const inRange = (index: number) => index >= start && index < end;
        let next: Block[] | null = null;
        let b = blockAt(this.current, start);
        for (; b < blocks.length; b++) {
            const block = blocks[b];
            if (!block || (block.indexes[0] ?? 0) >= end) break;
            const lost = block.indexes.some(
                (index, j) => inRange(index) && keyAt(index) !== block.keys[j],
            );
            if (!lost) {
                next?.push(block);
                continue;
            }
            next ??= blocks.slice(0, b);
            const kept = entriesOf(block).filter(
                ({ index, key }) => !inRange(index) || keyAt(index) === key,
            );
            if (kept.length > 0) next.push(blockOf(kept));
        }
        if (!next) return false;
        // the blocks after the range, as they are
        next.push(...blocks.slice(b));
        this.replace(next);
        return true;
    }

    /** Forgets every height; returns whether there was one. */
    clear(): boolean {
        if (this.current.blocks.length === 0) return false;
        this.replace([]);
        return true;
    }

    private replace(blocks: readonly Block[]) {
        this.current = blocks.length === 0 ? EMPTY : versionOf(blocks);
    }

    /**
     * An axis of `count` items, each `estimate` tall but the ones measured: built once per
     * version, count and estimate, in O(1).
     */
    axis(count: number, estimate: number): Axis {
        const built = this.built;
        if (
            built?.version === this.current &&
            built.count === count &&
            built.estimate === estimate
        ) {
            return built.axis;
        }
        const axis = new MeasuredAxis(count, estimate, this.current);
        this.built = { version: this.current, count, estimate, axis };
        return axis;
    }
}

/**
 * Items of `estimate` pixels but the measured ones (a version of the heights, which never
 * changes): an item's offset is its index times the estimate, plus what the measured items before
 * it add over theirs, found in O(log k).
 */
class MeasuredAxis implements Axis {
    readonly fixed = false;
    readonly count: number;
    readonly totalSize: number;

    constructor(
        count: number,
        private readonly estimate: number,
        private readonly measured: Blocks,
    ) {
        this.count = cleanCount(count);
        this.totalSize = this.startOf(this.count);
    }

    /** Where item `index` (0 … count) starts. */
    private startOf(index: number): number {
        const b = blockAt(this.measured, index);
        const block = this.measured.blocks[b];
        if (!block) return index * this.estimate;
        return startOf(
            this.measured,
            this.estimate,
            b,
            entryAt(block, index),
            index,
        );
    }

    offsetOf(index: number): number {
        return this.startOf(clampedIndex(index, this.count));
    }

    sizeOf(index: number): number {
        if (!(index >= 0 && index < this.count)) return 0;
        const item = Math.floor(index);
        const block = this.measured.blocks[blockAt(this.measured, item)];
        if (!block) return this.estimate;
        const j = entryAt(block, item);
        return block.indexes[j] === item
            ? (block.heights[j] ?? 0)
            : this.estimate;
    }

    extraSizeOf(): number {
        return 0;
    }

    indexAt(offset: number): number {
        if (this.count === 0) return -1;
        const last = this.count - 1;
        const { blocks } = this.measured;
        // the last measured item starting at or before the offset: its block, then itself
        soughtVersion = this.measured;
        soughtEstimate = this.estimate;
        sought = offset;
        const b = lowerBound(blocks.length, blockOffsetBy) - 1;
        const block = blocks[b];
        if (!block) {
            // before every measured item: estimates only
            const first = blocks[0]?.indexes[0] ?? last;
            return Math.min(
                Math.max(Math.floor(offset / this.estimate), 0),
                first,
                last,
            );
        }
        soughtBlock = b;
        const j = lowerBound(block.indexes.length, entryOffsetBy) - 1;
        const index = block.indexes[j] ?? 0;
        const end =
            startOf(this.measured, this.estimate, b, j, index) +
            (block.heights[j] ?? 0);
        if (offset < end) return Math.min(index, last);
        // after it, items of the estimate until the next measured one
        const next =
            block.indexes[j + 1] ??
            blocks[b + 1]?.indexes[0] ??
            Number.POSITIVE_INFINITY;
        return Math.min(
            index + 1 + Math.floor((offset - end) / this.estimate),
            next,
            last,
        );
    }

    withCount(count: number): Axis {
        return cleanCount(count) === this.count
            ? this
            : new MeasuredAxis(count, this.estimate, this.measured);
    }

    /** One estimate for every item: nothing a size function answers to compute again. */
    resized(): Axis {
        return this;
    }
}
