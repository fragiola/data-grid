// Demo data for the live market: fictional instruments whose prices walk at random, and a feed that
// moves them many times a second. Seeded, so the same seed gives the same market and the same
// ticks. App content and app policy, not part of the data grid: the grid is told which rows
// changed (`rows.changed`) and renders the ones on screen.

/** What kind of instrument a row is. */
export type InstrumentType = "Stock" | "ETF" | "Bond" | "Crypto" | "FX";

export const INSTRUMENT_TYPES: readonly InstrumentType[] = [
    "Stock",
    "ETF",
    "Bond",
    "Crypto",
    "FX",
];

/** How many prices a row keeps for its timeline. */
export const HISTORY = 24;

/** One instrument of the portfolio: a tick replaces it with a new one (its identity tells a change). */
export interface Instrument {
    readonly id: number;
    /** fictional: no real company, fund, bond or coin */
    readonly ticker: string;
    readonly name: string;
    readonly type: InstrumentType;
    readonly sector: string;
    /** how many units the portfolio holds */
    readonly quantity: number;
    /** what a unit cost when bought */
    readonly cost: number;
    /** the price the day opened at */
    readonly open: number;
    readonly price: number;
    readonly bid: number;
    readonly ask: number;
    /** units traded today */
    readonly volume: number;
    /** the last prices, oldest first */
    readonly history: readonly number[];
    /** how the last tick moved the price */
    readonly direction: "up" | "down";
    /** how many times the price moved */
    readonly ticks: number;
    /** when the price last moved (`performance.now()`), -Infinity before: what a flash fades from */
    readonly changedAt: number;
}

/** The change since the open, in price units. */
export function changeOf(instrument: Instrument): number {
    return instrument.price - instrument.open;
}

/** The change since the open, as a fraction of the open (0.01 is 1%). */
export function changeRatioOf(instrument: Instrument): number {
    return instrument.price / instrument.open - 1;
}

/** The position's value at the current price. */
export function positionValueOf(instrument: Instrument): number {
    return instrument.price * instrument.quantity;
}

/** The position's profit or loss against what it cost. */
export function profitOf(instrument: Instrument): number {
    return (instrument.price - instrument.cost) * instrument.quantity;
}

/** The portfolio's figures, over every instrument. */
export interface Totals {
    readonly value: number;
    readonly profit: number;
    readonly volume: number;
    readonly gainers: number;
    readonly losers: number;
}

export function totalsOf(instruments: readonly Instrument[]): Totals {
    let value = 0;
    let profit = 0;
    let volume = 0;
    let gainers = 0;
    let losers = 0;
    for (const instrument of instruments) {
        value += positionValueOf(instrument);
        profit += profitOf(instrument);
        volume += instrument.volume;
        const change = changeOf(instrument);
        if (change > 0) gainers++;
        else if (change < 0) losers++;
    }
    return { value, profit, volume, gainers, losers };
}

/** A seeded random source in [0, 1) (mulberry32): the same seed, the same numbers. */
export function randomSource(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let x = state;
        x = Math.imul(x ^ (x >>> 15), x | 1);
        x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
        return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
}

const SYLLABLES = [
    "ar",
    "bel",
    "cor",
    "dax",
    "el",
    "fen",
    "gal",
    "hal",
    "ix",
    "jor",
    "kel",
    "lum",
    "mor",
    "nov",
    "or",
    "pra",
    "qu",
    "ren",
    "sol",
    "tor",
    "ul",
    "vex",
    "wyn",
    "zen",
];

const STOCK_SUFFIXES = [
    "Systems",
    "Labs",
    "Energy",
    "Holdings",
    "Robotics",
    "Foods",
    "Logistics",
    "Bio",
    "Networks",
    "Motors",
];

const SECTORS = [
    "Technology",
    "Energy",
    "Health",
    "Finance",
    "Industrials",
    "Consumer",
    "Materials",
    "Utilities",
];

const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "CHF", "AUD", "CAD", "BRL"];

/** How a type's prices start and move: the price range, and a tick's typical move (a fraction). */
const PROFILES: Record<
    InstrumentType,
    { readonly low: number; readonly high: number; readonly step: number }
> = {
    Stock: { low: 8, high: 900, step: 0.004 },
    ETF: { low: 20, high: 500, step: 0.002 },
    Bond: { low: 85, high: 115, step: 0.0006 },
    Crypto: { low: 0.2, high: 60000, step: 0.012 },
    FX: { low: 0.6, high: 1.8, step: 0.0008 },
};

function pick<T>(items: readonly T[], random: () => number): T {
    return items[Math.floor(random() * items.length)] as T;
}

function capitalized(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
}

/** A ticker and a name for instrument `index` of a type: fictional, unique by the index. */
function naming(
    index: number,
    type: InstrumentType,
    random: () => number,
): { ticker: string; name: string } {
    const word = capitalized(pick(SYLLABLES, random) + pick(SYLLABLES, random));
    // the index keeps tickers unique, written in letters (A, B, …, Z, BA, …)
    let tag = "";
    for (let n = index; tag.length === 0 || n > 0; n = Math.floor(n / 26)) {
        tag = String.fromCharCode(65 + (n % 26)) + tag;
    }
    const stem = word.slice(0, 3).toUpperCase() + tag;
    switch (type) {
        case "Stock":
            return {
                ticker: stem,
                name: `${word} ${pick(STOCK_SUFFIXES, random)}`,
            };
        case "ETF":
            return { ticker: `${stem}X`, name: `${word} Index Fund` };
        case "Bond": {
            const years = pick([2, 5, 10, 20, 30], random);
            return {
                ticker: `${stem}${years}Y`,
                name: `${word} ${years}-Year Note`,
            };
        }
        case "Crypto":
            return { ticker: `${stem}-USD`, name: `${word} Coin` };
        case "FX": {
            const base = pick(CURRENCIES, random);
            const quote = pick(
                CURRENCIES.filter((currency) => currency !== base),
                random,
            );
            const months = pick([1, 3, 6, 12], random);
            return {
                ticker: `${base}${quote}${months}M`,
                name: `${base}/${quote} ${months}-month forward`,
            };
        }
    }
}

/** A type for instrument `index`: mostly stocks, as a portfolio is. */
function typeOf(random: () => number): InstrumentType {
    const roll = random();
    if (roll < 0.55) return "Stock";
    if (roll < 0.72) return "ETF";
    if (roll < 0.86) return "Bond";
    if (roll < 0.94) return "Crypto";
    return "FX";
}

/** Rounds a price to a sensible precision for its size. */
function rounded(price: number): number {
    const places = price >= 1000 ? 2 : price >= 1 ? 3 : 5;
    const factor = 10 ** places;
    return Math.round(price * factor) / factor;
}

/** `count` instruments, the same for the same seed. */
export function instruments(count: number, seed = 1): Instrument[] {
    const random = randomSource(seed);
    return Array.from({ length: count }, (_, index) => {
        const type = typeOf(random);
        const { low, high, step } = PROFILES[type];
        const open = rounded(low * (high / low) ** random());
        const { ticker, name } = naming(index, type, random);
        // a short past around the open, so every timeline starts full
        const history: number[] = [];
        let price = open;
        for (let point = 0; point < HISTORY; point++) {
            price = rounded(price * (1 + (random() - 0.5) * 2 * step * 4));
            history.push(price);
        }
        const spread = price * step * 0.5;
        return {
            id: index + 1,
            ticker,
            name,
            type,
            sector:
                type === "Stock" || type === "ETF"
                    ? pick(SECTORS, random)
                    : type === "Bond"
                      ? "Fixed income"
                      : type === "Crypto"
                        ? "Digital assets"
                        : "Currencies",
            quantity: Math.ceil(
                (2000 + random() * 48000) / Math.max(open, 0.5),
            ),
            cost: rounded(open * (0.8 + random() * 0.4)),
            open,
            price,
            bid: rounded(price - spread),
            ask: rounded(price + spread),
            volume: Math.floor(random() * 1_000_000),
            history,
            direction: price >= open ? "up" : "down",
            ticks: 0,
            changedAt: Number.NEGATIVE_INFINITY,
        };
    });
}

/**
 * Moves `count` instruments picked at random (some more than once): each one moved is replaced in
 * `market` by a new object with its new price, spread, volume, history and direction, stamped
 * `now`. Returns the indexes it moved, each once.
 */
export function tick(
    market: Instrument[],
    count: number,
    random: () => number,
    now: number,
): number[] {
    const moved = new Set<number>();
    for (let n = 0; n < count && market.length > 0; n++) {
        const index = Math.floor(random() * market.length);
        const instrument = market[index];
        if (!instrument) continue;
        const { step } = PROFILES[instrument.type];
        // a walk pulled gently back towards the open, so a long run stays readable
        const pull = (instrument.open - instrument.price) / instrument.open;
        const move = (random() - 0.5) * 2 * step + pull * step * 0.5;
        const price = rounded(Math.max(instrument.price * (1 + move), 0.00001));
        if (price === instrument.price) continue;
        const spread = price * step * 0.5;
        market[index] = {
            ...instrument,
            price,
            bid: rounded(price - spread),
            ask: rounded(price + spread),
            volume: instrument.volume + 1 + Math.floor(random() * 500),
            history: [...instrument.history.slice(1), price],
            direction: price > instrument.price ? "up" : "down",
            ticks: instrument.ticks + 1,
            changedAt: now,
        };
        moved.add(index);
    }
    return [...moved];
}

/** What the feed reports while it runs. */
export interface FeedStats {
    /** price changes in the last second */
    readonly updatesPerSecond: number;
    /** frames painted in the last second */
    readonly framesPerSecond: number;
}

/** A batch of moves: the instruments (by index in the market) one frame moved. */
export type FeedListener = (moved: readonly number[]) => void;

/**
 * The market's feed: on every animation frame while it plays, it moves as many instruments as
 * its rate asks for the time that passed (at most one batch a frame, whatever the rate), and
 * tells its listeners which ones. The rate is price changes a second.
 */
export interface MarketFeed {
    readonly market: Instrument[];
    readonly playing: boolean;
    readonly rate: number;
    play(): void;
    pause(): void;
    setRate(rate: number): void;
    /** moves `count` instruments now, playing or not (what a test steps with) */
    step(count: number): readonly number[];
    subscribe(listener: FeedListener): () => void;
    /** the last second's figures, told about twice a second */
    onStats(listener: (stats: FeedStats) => void): () => void;
    /** stops the frames for good */
    dispose(): void;
}

export function createMarketFeed(options: {
    readonly count: number;
    readonly rate: number;
    readonly seed?: number;
}): MarketFeed {
    const seed = options.seed ?? 1;
    const market = instruments(options.count, seed);
    const random = randomSource(seed + 1);
    const listeners = new Set<FeedListener>();
    const statsListeners = new Set<(stats: FeedStats) => void>();
    let rate = options.rate;
    let playing = false;
    let frame = 0;
    let last = 0;
    // what is owed between frames (a rate of 10 a second moves one every sixth frame)
    let owed = 0;
    // the last second's counts, reported every half second
    let windowStart = 0;
    let updates = 0;
    let frames = 0;

    function emit(moved: readonly number[]) {
        if (moved.length === 0) return;
        for (const listener of listeners) listener(moved);
    }

    function report(now: number) {
        const elapsed = now - windowStart;
        if (elapsed < 500) return;
        const stats = {
            updatesPerSecond: Math.round((updates * 1000) / elapsed),
            framesPerSecond: Math.round((frames * 1000) / elapsed),
        };
        windowStart = now;
        updates = 0;
        frames = 0;
        for (const listener of statsListeners) listener(stats);
    }

    function run(now: number) {
        frame = requestAnimationFrame(run);
        if (last === 0) {
            last = now;
            windowStart = now;
            return;
        }
        // a tab in the background resumes without a burst
        const elapsed = Math.min(now - last, 100);
        last = now;
        owed += (rate * elapsed) / 1000;
        const count = Math.floor(owed);
        owed -= count;
        frames++;
        if (count > 0) {
            const moved = tick(market, count, random, now);
            updates += moved.length;
            emit(moved);
        }
        report(now);
    }

    return {
        market,
        get playing() {
            return playing;
        },
        get rate() {
            return rate;
        },
        play() {
            if (playing) return;
            playing = true;
            last = 0;
            owed = 0;
            frame = requestAnimationFrame(run);
        },
        pause() {
            if (!playing) return;
            playing = false;
            cancelAnimationFrame(frame);
            for (const listener of statsListeners) {
                listener({ updatesPerSecond: 0, framesPerSecond: 0 });
            }
        },
        setRate(next) {
            rate = next;
        },
        step(count) {
            const moved = tick(market, count, random, performance.now());
            emit(moved);
            return moved;
        },
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        onStats(listener) {
            statsListeners.add(listener);
            return () => statsListeners.delete(listener);
        },
        dispose() {
            playing = false;
            cancelAnimationFrame(frame);
            listeners.clear();
            statsListeners.clear();
        },
    };
}

const MONEY = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});
const COMPACT = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
});
const PERCENT = new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
});

/** A price, with the precision its size needs. */
export function formatPrice(price: number): string {
    const places = price >= 1000 ? 2 : price >= 1 ? 3 : 5;
    return price.toLocaleString("en-US", {
        minimumFractionDigits: places,
        maximumFractionDigits: places,
    });
}

/** An amount of money, two decimals, without a sign. */
export function formatAmount(amount: number): string {
    return MONEY.format(Math.abs(amount));
}

/** A large count, short (1.2M). */
export function formatCompact(value: number): string {
    return COMPACT.format(value);
}

/** A ratio as a signed percentage (+1.25%). */
export function formatPercent(ratio: number): string {
    return PERCENT.format(ratio);
}
