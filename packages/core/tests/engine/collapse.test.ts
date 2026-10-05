// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import {
    type Column,
    type ColumnOrGroup,
    createDataGridModel,
    GROUP_LABEL_ATTRIBUTE,
    headerCellBox,
    headerCellPart,
    rowLeft,
} from "../../src";
import { columnsError } from "../../src/header/header";
import { mountEngine, type Row } from "./harness";

// Collapsible column groups and sticky group labels (Epic #85, E1.3): a collapsible group shows
// its children by its state (`groupShow`), the model keeping the collapsed groups' keys; what a
// collapse hides is no column, and the widths, the order, the sort and the active cell follow by
// key. A group's label is sticky in its header cell at an inset the engine writes, so it stays at
// the start of the columns that scroll while its group is scrolled partly out.

const column = (
    key: string,
    extra: Partial<Column<Row>> = {},
): Column<Row> => ({ key, width: 100, ...extra });

/**
 * "id"; "g", collapsible: "g0" in both states, "g1"–"g8" expanded only, "total" collapsed only;
 * "h" ("h0", "h1"), not collapsible; then "c0"–"c29": 100px each
 */
function columnsWith(
    extra: (key: string) => Partial<Column<Row>> = () => ({}),
): ColumnOrGroup<Row>[] {
    const leaf = (key: string, own: Partial<Column<Row>> = {}) =>
        column(key, { ...own, ...extra(key) });
    return [
        leaf("id"),
        {
            key: "g",
            collapsible: true,
            children: [
                leaf("g0"),
                ...Array.from({ length: 8 }, (_, i) =>
                    leaf(`g${i + 1}`, { groupShow: "expanded" }),
                ),
                leaf("total", { groupShow: "collapsed" }),
            ],
        },
        { key: "h", children: [leaf("h0"), leaf("h1")] },
        ...Array.from({ length: 30 }, (_, i) => leaf(`c${i}`)),
    ];
}

const COLUMNS = columnsWith();
const EXPANDED = ["id", ..."012345678".split("").map((i) => `g${i}`), "h0"];
const COLLAPSED = ["id", "g0", "total", "h0"];

const rows = Array.from({ length: 50 }, (_, id) => ({ id }));

function model(options: Parameters<typeof createDataGridModel<Row>>[0] = {}) {
    return createDataGridModel<Row>({ columns: COLUMNS, rows, ...options });
}

const keys = (m: ReturnType<typeof model>) =>
    m.get("columns").map((entry) => entry.key);

describe("validation", () => {
    it("takes a collapsible group showing a column in each state, groupShow under it only", () => {
        expect(columnsError(COLUMNS)).toBeNull();
        expect(
            columnsError([
                {
                    key: "g",
                    children: [column("a", { groupShow: "expanded" })],
                },
            ]),
        ).toMatch(/"a" has a groupShow, and its group is not collapsible/);
        expect(columnsError([column("a", { groupShow: "expanded" })])).toMatch(
            /not collapsible/,
        );
        expect(
            columnsError([
                {
                    key: "g",
                    collapsible: true,
                    // @ts-expect-error: not a state
                    children: [column("a", { groupShow: "open" })],
                },
            ]),
        ).toMatch(/"a" has an invalid groupShow/);
        expect(
            columnsError([
                {
                    key: "g",
                    collapsible: "yes",
                    children: [column("a")],
                },
            ]),
        ).toMatch(/invalid collapsible/);
        expect(
            columnsError([
                {
                    key: "g",
                    collapsible: true,
                    children: [column("a", { groupShow: "expanded" })],
                },
            ]),
        ).toMatch(/group "g" shows no column collapsed/);
        expect(
            columnsError([
                {
                    key: "g",
                    collapsible: true,
                    children: [column("a", { groupShow: "collapsed" })],
                },
            ]),
        ).toMatch(/group "g" shows no column expanded/);
        expect(() =>
            createDataGridModel<Row>({
                columns: [column("a", { groupShow: "collapsed" })],
            }),
        ).toThrow(/invalid columns/);
        expect(
            columnsError([
                {
                    key: "g",
                    children: [
                        // @ts-expect-error: a column does not collapse
                        column("a", { collapsible: true }),
                    ],
                },
            ]),
        ).toMatch(/column "a" is collapsible: a group collapses/);
    });
});

describe("the model", () => {
    it("shows a collapsible group's children by its state, keeping the header's rows", () => {
        const m = model();
        expect(keys(m).slice(0, 11)).toEqual(EXPANDED);
        expect(m.get("column-count")).toBe(42);
        expect(m.get("header-depth")).toBe(2);
        expect(m.state.header.cellByKey("g")?.columnSpan).toBe(9);
        expect(m.state.header.cellByKey("total")).toBeUndefined();
        expect(m.run("column-groups.toggle", { groupKey: "g" })).toEqual({
            ok: true,
            value: ["g"],
        });
        expect(keys(m).slice(0, 4)).toEqual(COLLAPSED);
        expect(m.get("column-count")).toBe(35);
        expect(m.get("header-depth")).toBe(2);
        expect(m.state.header.cellByKey("g")?.columnSpan).toBe(2);
        expect(m.state.header.cellByKey("g1")).toBeUndefined();
        expect(m.get("collapsed-group-keys")).toEqual(["g"]);
        expect(m.is("group-collapsed", { groupKey: "g" })).toBe(true);
        expect(m.is("group-collapsed", { groupKey: "h" })).toBe(false);
        expect(m.run("column-groups.toggle", { groupKey: "g" })).toEqual({
            ok: true,
            value: [],
        });
        expect(keys(m).slice(0, 11)).toEqual(EXPANDED);
    });

    it("starts collapsed from an option, and sets the keys, kept when they are no group", () => {
        const m = model({ collapsedGroupKeys: ["g", "gone", "g"] });
        expect(m.get("collapsed-group-keys")).toEqual(["g", "gone"]);
        expect(keys(m).slice(0, 4)).toEqual(COLLAPSED);
        // a key that is no collapsible group collapses nothing, and is kept
        expect(m.is("group-collapsed", { groupKey: "gone" })).toBe(false);
        const before = m.state;
        expect(
            m.run("column-groups.set", { groupKeys: ["g", "gone"] }).ok,
        ).toBe(true);
        expect(m.state).toBe(before);
        expect(m.run("column-groups.set", { groupKeys: ["h", "h"] })).toEqual({
            ok: true,
            value: ["h"],
        });
        expect(keys(m).slice(0, 11)).toEqual(EXPANDED);
        const invalid = m.run("column-groups.set", {
            // @ts-expect-error: not keys
            groupKeys: [1],
        });
        expect(!invalid.ok && invalid.error.code).toBe("invalid_payload");
    });

    it("toggles a collapsible group only", () => {
        const m = model();
        const missing = m.run("column-groups.toggle", { groupKey: "nope" });
        expect(!missing.ok && missing.error.code).toBe("not_found");
        // a column is no group
        const leaf = m.run("column-groups.toggle", { groupKey: "g0" });
        expect(!leaf.ok && leaf.error.code).toBe("not_found");
        const fixed = m.run("column-groups.toggle", { groupKey: "h" });
        expect(!fixed.ok && fixed.error.code).toBe("refused");
    });

    it("toggles a group a collapsed one hides, which shows its state once expanded", () => {
        const m = createDataGridModel<Row>({
            rows,
            columns: [
                {
                    key: "n",
                    collapsible: true,
                    children: [
                        {
                            key: "s",
                            collapsible: true,
                            groupShow: "expanded",
                            children: [
                                column("s0"),
                                column("s1", { groupShow: "expanded" }),
                            ],
                        },
                        column("n0", { groupShow: "collapsed" }),
                    ],
                },
            ],
        });
        expect(keys(m)).toEqual(["s0", "s1"]);
        expect(m.get("header-depth")).toBe(3);
        m.run("column-groups.toggle", { groupKey: "n" });
        expect(keys(m)).toEqual(["n0"]);
        // the header keeps its rows: n0 spans the two below "n"
        expect(m.get("header-depth")).toBe(3);
        expect(m.state.header.cellByKey("n0")?.rowSpan).toBe(2);
        expect(m.run("column-groups.toggle", { groupKey: "s" }).ok).toBe(true);
        m.run("column-groups.toggle", { groupKey: "n" });
        expect(keys(m)).toEqual(["s0"]);
    });

    it("keeps a hidden column's width, its place in the order and its sort", () => {
        const sortable = columnsWith((key) =>
            key === "g3" ? { sortable: true, resizable: true } : {},
        );
        const m = createDataGridModel<Row>({
            columns: sortable,
            rows,
            columnWidths: { g3: 150 },
            sortColumns: [{ columnKey: "g3", direction: "ascending" }],
            columnOrder: ["g8", "g0"],
        });
        expect(keys(m).slice(1, 3)).toEqual(["g8", "g1"]);
        m.run("column-groups.toggle", { groupKey: "g" });
        expect(m.get("column-widths")).toEqual({ g3: 150 });
        expect(m.get("column-width-by", { columnKey: "g3" })).toBeUndefined();
        expect(m.get("sort-columns")).toEqual([
            { columnKey: "g3", direction: "ascending" },
        ]);
        expect(m.is("column-sortable", { columnKey: "g3" })).toBe(true);
        // new columns keep it, a sort can name it
        m.run("columns.set", { columns: [...sortable] });
        expect(m.get("sort-columns")).toHaveLength(1);
        expect(
            m.run("sort-columns.set", {
                sortColumns: [{ columnKey: "g3", direction: "descending" }],
            }).ok,
        ).toBe(true);
        m.run("column-groups.toggle", { groupKey: "g" });
        expect(keys(m).slice(1, 10)).toEqual([
            "g8",
            "g1",
            "g2",
            "g3",
            "g4",
            "g5",
            "g6",
            "g7",
            "g0",
        ]);
        expect(m.get("column-width-by", { columnKey: "g3" })).toBe(150);
    });

    it("keeps the active cell on its column, and moves it off a hidden one to the nearest its group shows", () => {
        const m = model();
        // c5 at 1 + 9 + 2 + 5
        m.run("active-position.set", { rowIndex: 3, columnIndex: 17 });
        m.run("column-groups.toggle", { groupKey: "g" });
        expect(m.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 10,
        });
        m.run("column-groups.toggle", { groupKey: "g" });
        // g5, hidden: g0 is the nearest column "g" shows (the collapsed-only "total" was none)
        m.run("active-position.set", { rowIndex: 3, columnIndex: 6 });
        m.run("column-groups.toggle", { groupKey: "g" });
        expect(m.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 1,
        });
        // "total", hidden by the expand: its nearest is g0 again
        m.run("active-position.set", { rowIndex: 3, columnIndex: 2 });
        m.run("column-groups.toggle", { groupKey: "g" });
        expect(m.get("active-position")).toEqual({
            rowIndex: 3,
            columnIndex: 1,
        });
        // a header cell: g4's falls back on g0's, the group's stays
        m.run("active-position.set", { rowIndex: -1, columnIndex: 5 });
        m.run("column-groups.toggle", { groupKey: "g" });
        expect(m.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 1,
        });
        m.run("active-position.set", { rowIndex: -2, columnIndex: 2 });
        expect(m.get("active-position")).toEqual({
            rowIndex: -2,
            columnIndex: 1,
        });
        m.run("column-groups.toggle", { groupKey: "g" });
        expect(m.get("active-position")).toEqual({
            rowIndex: -2,
            columnIndex: 1,
        });
    });
});

/** "id"; "y", collapsible: "m1"–"m4" expanded only, "ytotal" collapsed only; then "z" and 20 more */
const SWAPPED: ColumnOrGroup<Row>[] = [
    column("id"),
    {
        key: "y",
        collapsible: true,
        children: [
            ...[1, 2, 3, 4].map((i) =>
                column(`m${i}`, { groupShow: "expanded" }),
            ),
            column("ytotal", { groupShow: "collapsed" }),
        ],
    },
    column("z"),
    ...Array.from({ length: 20 }, (_, i) => column(`c${i}`)),
];

describe("a group whose children are swapped", () => {
    it("moves the active cell off a hidden column to its group's first column, never past it", () => {
        const m = createDataGridModel<Row>({ columns: SWAPPED, rows });
        m.run("active-position.set", { rowIndex: 2, columnIndex: 4 });
        m.run("column-groups.toggle", { groupKey: "y" });
        // "ytotal", the only column "y" shows, not "z"
        expect(m.get("active-position")).toEqual({
            rowIndex: 2,
            columnIndex: 1,
        });
        expect(keys(m).slice(0, 3)).toEqual(["id", "ytotal", "z"]);
        // the header cell of a hidden column: the same
        m.run("column-groups.toggle", { groupKey: "y" });
        m.run("active-position.set", { rowIndex: -1, columnIndex: 3 });
        m.run("column-groups.toggle", { groupKey: "y" });
        expect(m.get("active-position")).toEqual({
            rowIndex: -1,
            columnIndex: 1,
        });
    });
});

describe("the model's set of keys", () => {
    it("takes the same keys in another order as no change", () => {
        const m = createDataGridModel<Row>({
            columns: [
                ...COLUMNS,
                {
                    key: "k",
                    collapsible: true,
                    children: [
                        column("k0"),
                        column("k1", { groupShow: "expanded" }),
                    ],
                },
            ],
            rows,
            collapsedGroupKeys: ["g", "k"],
        });
        const before = m.state;
        expect(m.run("column-groups.set", { groupKeys: ["k", "g"] })).toEqual({
            ok: true,
            value: ["g", "k"],
        });
        expect(m.state).toBe(before);
    });
});

describe("the engine", () => {
    function setup(
        options: {
            columns?: ColumnOrGroup<Row>[];
            maxScrollSize?: number;
            direction?: "ltr" | "rtl";
        } = {},
    ) {
        const mounted = mountEngine(
            {
                columns: options.columns ?? COLUMNS,
                rowCount: 1_000,
                direction: options.direction,
            },
            {
                overscan: { rows: 2, columns: 1 },
                maxScrollSize: options.maxScrollSize,
                width: 400,
                height: 230,
                clamp: true,
                layers: ["header", "body"],
            },
        );
        const { viewport, commit, header, engine } = mounted;
        /** a native scroll to the physical `scrollLeft` */
        const scrollLeft = (left: number) => {
            viewport.scrollLeft = left;
            viewport.dispatchEvent(new Event("scroll"));
            commit();
        };
        /** a group's label, as `useGroupLabel` marks it, registered */
        const label = (groupKey: string) => {
            const element = document.createElement("span");
            element.setAttribute(GROUP_LABEL_ATTRIBUTE, groupKey);
            header.append(element);
            const release = engine.adapter.registerLayer("label", element);
            return { element, release };
        };
        return { ...mounted, scrollLeft, label };
    }

    /** The physical x a layer's transform moves it by. */
    function translateX(layer: HTMLElement): number {
        const match = /translate3d\(([-\d.e]+)px/.exec(layer.style.transform);
        if (!match) throw new Error(`no transform: ${layer.style.transform}`);
        return Number(match[1]);
    }

    it("tells a collapsible group's header cell collapsed or not, and others nothing", () => {
        const { view, model: m } = setup();
        const stateOf = (key: string) => {
            const cell = view().header.cellByKey(key);
            if (!cell) throw new Error(`no cell ${key}`);
            return headerCellPart(view(), cell).state.collapsed;
        };
        expect(stateOf("g")).toBe(false);
        expect(stateOf("h")).toBeUndefined();
        expect(stateOf("g0")).toBeUndefined();
        m.run("column-groups.toggle", { groupKey: "g" });
        expect(stateOf("g")).toBe(true);
        expect(view().collapsedGroupKeys).toEqual(["g"]);
    });

    it("keeps the view on the column it shows first, or a hidden one's group at its start", () => {
        const { engine, model: m, scrollLeft, commit, viewport } = setup();
        // c3 first, 30px into it
        scrollLeft(1_530);
        m.run("column-groups.toggle", { groupKey: "g" });
        commit();
        expect(engine.get("scroll-position").left).toBe(830);
        expect(viewport.scrollLeft).toBe(830);
        m.run("column-groups.toggle", { groupKey: "g" });
        commit();
        expect(engine.get("scroll-position").left).toBe(1_530);
        // g3 first: hidden, the view goes to "g"'s start
        scrollLeft(450);
        m.run("column-groups.toggle", { groupKey: "g" });
        commit();
        expect(engine.get("scroll-position").left).toBe(100);
    });

    it("holds a group's label at the view's start while its group scrolls out, never per frame unscaled", () => {
        const { view, header, scrollLeft, label } = setup();
        const { element, release } = label("g");
        // in view: at its place
        expect(element.style.left).toBe("0px");
        scrollLeft(450);
        const x = translateX(header);
        expect(element.style.left).toBe(`${-x}px`);
        // the label shows at the view's start: the scroll plus its inset, moved by the layer
        const cell = view().header.cellByKey("g");
        if (!cell) throw new Error("no cell");
        const layout = rowLeft(view()) + headerCellBox(view(), cell).left;
        const shown = Math.max(
            layout,
            450 + Number.parseFloat(element.style.left),
        );
        expect(shown + x - 450).toBe(0);
        // inside the overscan: the same view, the same inset
        const before = element.style.left;
        scrollLeft(470);
        expect(element.style.left).toBe(before);
        release();
        expect(element.style.left).toBe("");
    });

    it("holds it right of the columns pinned at the start, and leaves a pinned group's alone", () => {
        const { header, scrollLeft, label } = setup({
            columns: [
                {
                    key: "p",
                    children: [
                        column("p0", { pinned: "start" }),
                        column("p1", { pinned: "start" }),
                    ],
                },
                ...COLUMNS,
            ],
        });
        const g = label("g").element;
        const p = label("p").element;
        scrollLeft(450);
        expect(g.style.left).toBe(`${200 - translateX(header)}px`);
        expect(p.style.left).toBe("");
    });

    it("writes the label's inset with every frame under scaled column scroll", () => {
        const wide: ColumnOrGroup<Row>[] = [
            {
                key: "g",
                collapsible: true,
                children: Array.from({ length: 200 }, (_, i) =>
                    column(`g${i}`, i > 0 ? { groupShow: "expanded" } : {}),
                ),
            },
        ];
        const { engine, header, scrollLeft, label } = setup({
            columns: wide,
            maxScrollSize: 5_000,
        });
        expect(engine.get("scroll-scaled").columns).toBe(true);
        const { element } = label("g");
        const insets = new Set<string>();
        for (const left of [1_000, 1_003, 2_500, 2_502]) {
            scrollLeft(left);
            // at the view's start whatever the frame: its inset follows the layers' x
            expect(element.style.left).toBe(`${-translateX(header)}px`);
            insets.add(element.style.left);
        }
        expect(insets.size).toBe(4);
    });

    it("keeps the view and the active cell where they were when a swapped group's columns go", () => {
        const {
            engine,
            model: m,
            scrollLeft,
            commit,
        } = setup({
            columns: SWAPPED,
        });
        m.run("active-position.set", { rowIndex: 2, columnIndex: 4 });
        commit();
        // m4 brought into view: m1 first
        expect(engine.get("scroll-position").left).toBe(100);
        m.run("column-groups.toggle", { groupKey: "y" });
        commit();
        expect(m.get("active-position")).toEqual({
            rowIndex: 2,
            columnIndex: 1,
        });
        // ytotal first, where m1 was: no jump
        expect(engine.get("scroll-position").left).toBe(100);
        m.run("column-groups.toggle", { groupKey: "y" });
        commit();
        // m2 first, hidden: the view starts at the column "y" shows, ytotal
        scrollLeft(250);
        m.run("column-groups.toggle", { groupKey: "y" });
        commit();
        expect(engine.get("scroll-position").left).toBe(100);
    });

    it("keeps a group's header cell in interaction as it opens and closes", () => {
        const { engine, model: m, header, commit } = setup();
        const cell = document.createElement("div");
        cell.dataset.rowIndex = "-2";
        cell.dataset.columnIndex = "1";
        cell.innerHTML = "<button>toggle</button>";
        header.append(cell);
        engine.run("interact-cell", { rowIndex: -2, columnIndex: 1 });
        commit();
        expect(engine.get("interaction")).toEqual({
            rowIndex: -2,
            columnIndex: 1,
        });
        m.run("column-groups.toggle", { groupKey: "g" });
        commit();
        expect(engine.get("interaction")).toEqual({
            rowIndex: -2,
            columnIndex: 1,
        });
    });

    it("puts aria-sort on the first sorted column shown, a hidden one keeping its priority", () => {
        const sortable = columnsWith((key) =>
            key === "g3" || key === "c0" ? { sortable: true } : {},
        );
        const { view, model: m } = setup({ columns: sortable });
        m.run("sort-columns.set", {
            sortColumns: [
                { columnKey: "g3", direction: "ascending" },
                { columnKey: "c0", direction: "descending" },
            ],
        });
        const part = (key: string) => {
            const cell = view().header.cellByKey(key);
            if (!cell) throw new Error(`no cell ${key}`);
            return headerCellPart(view(), cell);
        };
        expect(part("g3").ariaSort).toBe("ascending");
        expect(part("c0").ariaSort).toBeUndefined();
        m.run("column-groups.toggle", { groupKey: "g" });
        expect(part("c0").ariaSort).toBe("descending");
        expect(part("c0").state.sortPriority).toBe(2);
    });

    it("writes it on the right right to left", () => {
        const { header, scrollLeft, label } = setup({ direction: "rtl" });
        const { element } = label("g");
        scrollLeft(-450);
        expect(element.style.left).toBe("");
        // the layers move by −x right to left
        expect(element.style.right).toBe(`${translateX(header)}px`);
    });
});
