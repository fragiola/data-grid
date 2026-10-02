// OKLCH → sRGB and WCAG contrast, for the theme contrast guard. Mirrors the
// approach of fragiola/ui tests/palette-utils.ts.

export type RGB = [number, number, number];

/** Parses `oklch(L C H)` (L as 0–1, optional `/ alpha` ignored). */
export function parseOklch(value: string): [number, number, number] {
    const match = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(value);
    if (!match) throw new Error(`not an oklch() colour: ${value}`);
    return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** OKLCH → gamma-encoded sRGB, each channel clamped to 0–1. */
export function oklchToSrgb([l, c, h]: [number, number, number]): RGB {
    const a = c * Math.cos((h * Math.PI) / 180);
    const b = c * Math.sin((h * Math.PI) / 180);
    const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
    const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
    const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
    const linear: RGB = [
        4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
        -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
        -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
    ];
    return linear.map((v) => {
        const x = Math.min(1, Math.max(0, v));
        return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
    }) as RGB;
}

/** `top` at `alpha` over `bottom`, composited in sRGB as browsers do. */
export function blend(top: RGB, bottom: RGB, alpha: number): RGB {
    return top.map((v, i) => v * alpha + (bottom[i] ?? 0) * (1 - alpha)) as RGB;
}

function luminance(rgb: RGB): number {
    const [r, g, b] = rgb.map((v) =>
        v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4,
    ) as RGB;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: RGB, b: RGB): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
        number,
        number,
    ];
    return (hi + 0.05) / (lo + 0.05);
}
