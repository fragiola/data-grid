import { expect, type Page, test } from "@playwright/test";
import { scrollTo, settle, viewport } from "./examples/helpers";
import { openExample } from "./helpers";

// Clean edges (Epic #166, examples-shared/styles/grid-edges.css): at a device pixel ratio that puts
// the viewport's edge between two device pixels, the cells scrolling under a sticky part never
// show at the edge (rows of dots along it). Each check takes a thin strip just inside one edge
// twice, with the cells that scroll shown and hidden: the strip shows the sticky part alone, so
// both are the same but for blending (`UNSEEN`). A few scroll offsets apart, the cells' text
// crosses every edge.

type Edge = "top" | "start" | "end" | "bottom";

const CASES: { slug: string; edges: Edge[]; webkit?: Edge[] }[] = [
    // a billion cells, both axes scaled, a row number column pinned at the start. WebKit still
    // blends a sliver into the start edge at some offsets there (#168): its top
    // only
    { slug: "large-dataset", edges: ["top", "start"], webkit: ["top"] },
    // the header alone at the top, no column pinned
    { slug: "many-columns", edges: ["top"] },
    // the header at the top, columns pinned at both ends
    { slug: "pinned-columns", edges: ["top", "start", "end"] },
    // summary rows stuck to the bottom edge
    { slug: "summary-rows", edges: ["top", "bottom"] },
    // the grid mirrored: the start is on the right
    { slug: "rtl", edges: ["top", "start", "end"] },
];

/** a ratio that leaves the viewport's edges between device pixels */
test.use({ deviceScaleFactor: 1.25 });

/** the strip's thickness, in CSS pixels: the device pixel at the edge and the next */
const STRIP = 2;
/** what a strip leaves out at both ends: the frame's rounded corners */
const CORNER = 24;
/** the scroll offsets, in pixels: a row's and a column's text cross the edges at one of them */
const OFFSETS = [0, 11, 23, 37];
/**
 * A channel's difference left to blending: the rows' lines, which run under the pinned cells, blend
 * with what is under them; and where a scroll offset is a fraction too, Chromium draws the pinned
 * cells and the cells under them as two layers, each clipped at the fraction, so at most a quarter
 * of a glyph's contrast blends into the edge's pixel. A cell's text showing there (the bug) is
 * the whole contrast, far above it.
 */
const UNSEEN = 64;

type Clip = { x: number; y: number; width: number; height: number };

async function strip(page: Page, edge: Edge): Promise<Clip> {
    const box = await viewport(page).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
            left: rect.left + Number.parseFloat(style.borderLeftWidth),
            top: rect.top + Number.parseFloat(style.borderTopWidth),
            width: element.clientWidth,
            height: element.clientHeight,
            rtl: style.direction === "rtl",
        };
    });
    const side =
        edge === "start"
            ? box.rtl
                ? "right"
                : "left"
            : edge === "end"
              ? box.rtl
                  ? "left"
                  : "right"
              : edge;
    const across = { x: box.left + CORNER, width: box.width - 2 * CORNER };
    const along = { y: box.top + CORNER, height: box.height - 2 * CORNER };
    if (side === "top") return { ...across, y: box.top, height: STRIP };
    if (side === "bottom") {
        return { ...across, y: box.top + box.height - STRIP, height: STRIP };
    }
    if (side === "left") return { ...along, x: box.left, width: STRIP };
    return { ...along, x: box.left + box.width - STRIP, width: STRIP };
}

/** How many pixels of two screenshots differ by more than the eye ignores (decoded in the page). */
function seenDifferences(page: Page, a: Buffer, b: Buffer): Promise<number> {
    return page.evaluate(
        async ({ a, b, unseen }) => {
            const decode = async (base64: string) => {
                const image = new Image();
                image.src = `data:image/png;base64,${base64}`;
                await image.decode();
                const canvas = document.createElement("canvas");
                canvas.width = image.width;
                canvas.height = image.height;
                const context = canvas.getContext("2d");
                if (!context) throw new Error("no 2d context");
                context.drawImage(image, 0, 0);
                return context.getImageData(0, 0, image.width, image.height)
                    .data;
            };
            const [first, second] = await Promise.all([decode(a), decode(b)]);
            let seen = 0;
            for (let index = 0; index < first.length; index += 4) {
                for (let channel = 0; channel < 3; channel++) {
                    const difference = Math.abs(
                        (first[index + channel] ?? 0) -
                            (second[index + channel] ?? 0),
                    );
                    if (difference > unseen) {
                        seen++;
                        break;
                    }
                }
            }
            return seen;
        },
        { a: a.toString("base64"), b: b.toString("base64"), unseen: UNSEEN },
    );
}

/** on the viewport: the cells that scroll are hidden */
const HIDDEN = "data-edges-hidden";

async function hideScrollingCells(page: Page, hidden: boolean) {
    await viewport(page).evaluate(
        (element, { name, hidden }) => {
            element.toggleAttribute(name, hidden);
        },
        { name: HIDDEN, hidden },
    );
    await settle(page);
}

for (const { slug, webkit, ...all } of CASES) {
    test(`${slug}: the cells scrolling under the sticky parts never show at the edges`, async ({
        page,
        browserName,
    }) => {
        const edges = (browserName === "webkit" && webkit) || all.edges;
        await openExample(page, slug, { theme: "dark" });
        // a fraction of a pixel off the grid, so its edges fall between device pixels
        await page.addStyleTag({
            content: `
                body { padding: 0.7px 0 0 0.7px; }
                [${HIDDEN}] [data-grid-part="cell"]:not([data-pinned]) { visibility: hidden !important; }
            `,
        });
        const start = await viewport(page).evaluate((element) => ({
            top: Math.round(
                (element.scrollHeight - element.clientHeight) * 0.373,
            ),
            left: Math.round(
                (element.scrollWidth - element.clientWidth) * 0.503,
            ),
            // a mirrored grid scrolls to negative offsets
            sign: getComputedStyle(element).direction === "rtl" ? -1 : 1,
        }));
        for (const offset of OFFSETS) {
            await scrollTo(page, {
                top: start.top + offset + 0.3,
                left: start.sign * (start.left + offset * 3 + 0.3),
            });
            const strips = await Promise.all(
                edges.map((edge) => strip(page, edge)),
            );
            for (const [index, clip] of strips.entries()) {
                const shown = await page.screenshot({
                    clip,
                    animations: "disabled",
                });
                await hideScrollingCells(page, true);
                const hidden = await page.screenshot({
                    clip,
                    animations: "disabled",
                });
                await hideScrollingCells(page, false);
                expect
                    .soft(
                        await seenDifferences(page, shown, hidden),
                        `the ${edges[index]} edge shows the cells scrolling under it (scrolled ${offset}px further)`,
                    )
                    .toBe(0);
            }
        }
    });
}
