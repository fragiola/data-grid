import { describe, expect, it } from "vitest";
import {
    HISTORY,
    instruments,
    positionValueOf,
    randomSource,
    tick,
    totalsOf,
} from "../src/examples/_kit/market";

// The live market's demo data (`_kit/market.ts`): the same seed, the same market and the same
// ticks, a full timeline from the start, and a tick that replaces exactly what it moved.

describe("the market", () => {
    it("is the same for the same seed, another for another", () => {
        expect(instruments(50, 7)).toEqual(instruments(50, 7));
        expect(instruments(50, 7)).not.toEqual(instruments(50, 8));
    });

    it("gives every instrument a full timeline ending at its price", () => {
        for (const instrument of instruments(200)) {
            expect(instrument.history).toHaveLength(HISTORY);
            expect(instrument.history.at(-1)).toBe(instrument.price);
            expect(instrument.bid).toBeLessThanOrEqual(instrument.price);
            expect(instrument.ask).toBeGreaterThanOrEqual(instrument.price);
            expect(instrument.quantity).toBeGreaterThan(0);
        }
    });

    it("ticks the same way for the same seed", () => {
        const a = instruments(100);
        const b = instruments(100);
        expect(tick(a, 40, randomSource(3), 1)).toEqual(
            tick(b, 40, randomSource(3), 1),
        );
        expect(a).toEqual(b);
    });

    it("replaces the instruments it moves, and only those", () => {
        const market = instruments(100);
        const before = [...market];
        const moved = tick(market, 30, randomSource(5), 42);
        expect(moved.length).toBeGreaterThan(0);
        expect(new Set(moved).size).toBe(moved.length);
        market.forEach((instrument, index) => {
            const old = before[index];
            if (!old) throw new Error("no instrument");
            if (moved.includes(index)) {
                expect(instrument).not.toBe(old);
                expect(instrument.price).not.toBe(old.price);
                // picked at random: one may move twice in a batch
                expect(instrument.ticks).toBeGreaterThan(old.ticks);
                expect(instrument.changedAt).toBe(42);
                expect(instrument.history).toHaveLength(HISTORY);
                expect(instrument.history.at(-1)).toBe(instrument.price);
            } else {
                expect(instrument).toBe(old);
            }
        });
    });

    it("adds the portfolio up", () => {
        const market = instruments(30);
        const totals = totalsOf(market);
        expect(totals.value).toBeCloseTo(
            market.reduce(
                (sum, instrument) => sum + positionValueOf(instrument),
                0,
            ),
        );
        expect(totals.gainers + totals.losers).toBeLessThanOrEqual(30);
    });
});
