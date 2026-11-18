import {
    ChangeDetectionStrategy,
    Component,
    computed,
    input,
} from "@angular/core";
import { LucideArrowDown, LucideArrowUp } from "@lucide/angular";
import { hash } from "../_kit/data";
import { formatAmount, formatPrice, type Instrument } from "../_kit/market";
import * as styles from "./styles";

// The cells' content: each one reads its instrument, a new object whenever it moves, so a cell
// renders again only when its row changed. Each goes on the app's own element
// (`<span examplePriceCell [instrument]="row">`), which wears its look.

/** how long a moved price stays lit, in milliseconds (the flash's fade, `styles.flash`) */
const FLASH = 700;

/** The instrument's logo: its ticker's first letters on a colour of its own (all are fictional). */
@Component({
    selector: "[exampleLogo]",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "aria-hidden": "true", "[class]": "look()" },
    template: "{{ letters() }}",
})
export class Logo {
    readonly instrument = input.required<Instrument>();
    protected readonly look = computed(() =>
        styles.logo(hash(this.instrument().id, 6)),
    );
    protected readonly letters = computed(() =>
        this.instrument().ticker.slice(0, 2),
    );
}

/** The ticker in bold, its name after it. */
@Component({
    selector: "[exampleTickerCell]",
    imports: [Logo],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.ticker" },
    template: `
        <span exampleLogo [instrument]="instrument()"></span>
        <span [class]="styles.symbol">{{ instrument().ticker }}</span>
        <span [class]="styles.name">{{ instrument().name }}</span>
    `,
})
export class TickerCell {
    protected readonly styles = styles;
    readonly instrument = input.required<Instrument>();
}

/**
 * The last prices as bars, scaled between their lowest and highest: worked out again only when
 * the history is a new one. It goes on the app's `<svg>`.
 */
@Component({
    selector: "svg[exampleTimeline]",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        "aria-hidden": "true",
        preserveAspectRatio: "none",
        "[attr.viewBox]": "viewBox()",
        "[class]": "styles.timeline",
    },
    template: `
        @for (bar of bars(); track bar.x) {
            <svg:rect
                [attr.x]="bar.x"
                [attr.y]="24 - bar.height"
                width="3"
                [attr.height]="bar.height"
                [class]="styles.bar"
            />
        }
    `,
})
export class Timeline {
    protected readonly styles = styles;
    readonly history = input.required<readonly number[]>();
    protected readonly viewBox = computed(
        () => `0 0 ${this.history().length * 4} 24`,
    );
    protected readonly bars = computed(() => {
        const history = this.history();
        const low = Math.min(...history);
        const range = Math.max(...history) - low || 1;
        return history.map((price, index) => ({
            x: index * 4,
            height: 2 + ((price - low) / range) * 22,
        }));
    });
}

/**
 * The price, lit up or down for a moment when it moves: the flash is a layer that fades out
 * once, created again (tracked by the instrument's `ticks`) by the next move. A row scrolled into
 * view long after its last move shows no flash.
 */
@Component({
    selector: "[examplePriceCell]",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.price" },
    template: `
        @for (moved of flashes(); track moved.ticks) {
            <span [attr.data-flash]="moved.direction" [class]="styles.flash(moved.direction)"></span>
        }
        <span [class]="styles.priceValue">{{ price() }}</span>
    `,
})
export class PriceCell {
    protected readonly styles = styles;
    readonly instrument = input.required<Instrument>();
    /** the move to flash, if it is fresh: none, or one tracked by its ticks */
    protected readonly flashes = computed(() => {
        const instrument = this.instrument();
        return performance.now() - instrument.changedAt < FLASH
            ? [instrument]
            : [];
    });
    protected readonly price = computed(() =>
        formatPrice(this.instrument().price),
    );
}

/** An arrow up or down, coloured, and a signed figure (its content; nothing for zero). */
@Component({
    selector: "[exampleDelta]",
    imports: [LucideArrowUp, LucideArrowDown],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "look()" },
    template: `
        @if (side() === "up") {
            <svg lucideArrowUp aria-hidden="true" [class]="styles.arrow"></svg>
        } @else if (side() === "down") {
            <svg lucideArrowDown aria-hidden="true" [class]="styles.arrow"></svg>
        }
        <ng-content />
    `,
})
export class Delta {
    protected readonly styles = styles;
    readonly value = input.required<number>({ alias: "exampleDelta" });
    protected readonly side = computed(() => {
        const value = this.value();
        return value > 0 ? "up" : value < 0 ? "down" : "flat";
    });
    protected readonly look = computed(() => styles.delta(this.side()));
}

/** A movement beside a pill: the day's (or the position's) change, then the figure it moves. */
@Component({
    selector: "[exampleDeltaPill]",
    imports: [Delta],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.deltaPill" },
    template: `
        <span [exampleDelta]="delta()">{{ amount() }}</span>
        <span [class]="styles.pill(tone())">{{ value() }}</span>
    `,
})
export class DeltaPill {
    protected readonly styles = styles;
    readonly delta = input.required<number>();
    readonly value = input.required<string>();
    readonly tone = input.required<number>();
    protected readonly amount = computed(() => formatAmount(this.delta()));
}

/** Today's volume, and a bar of it against the busiest the demo expects. */
@Component({
    selector: "[exampleVolumeCell]",
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: { "[class]": "styles.volume" },
    template: `
        <span [class]="styles.volumeTrack">
            <span [class]="styles.volumeBar" [style.inline-size]="share()"></span>
        </span>
        <span [class]="styles.volumeValue">{{ label() }}</span>
    `,
})
export class VolumeCell {
    protected readonly styles = styles;
    readonly volume = input.required<number>();
    readonly label = input.required<string>();
    protected readonly share = computed(
        () => `${Math.round(Math.min(this.volume() / 2_000_000, 1) * 100)}%`,
    );
}
