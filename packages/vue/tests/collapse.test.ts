import { describe, expect, it, vi } from "vitest";
import {
    defineComponent,
    type PropType,
    shallowRef,
    type VNodeChild,
} from "vue";
import {
    type CellInfo,
    type Column,
    type ColumnOrGroup,
    type HeaderCellInfo,
    type HeaderRowInfo,
    type RootProps,
    type RowInfo,
    typedDataGrid,
    useDataGrid,
    useGroupLabel,
    useHeaderCell,
} from "../src";
import {
    cellAt,
    click,
    FEATURES,
    type Features,
    h,
    renderGrid,
    root,
    scrollRoot,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Collapsible groups and sticky labels (Epic #85, E1.3): the collapsed groups controlled or not
// on `Root`, toggled by the app's own control in the group's header cell; `data-collapsible`,
// `data-collapsed`; a group's label (`useGroupLabel`) whose inset the engine writes while the
// group scrolls, Vue rendering nothing for it (D9). Both structures.

interface Row {
    id: number;
}

const G = typedDataGrid<Row, Features>();

const rows: Row[] = Array.from({ length: 30 }, (_, id) => ({ id }));

const column = (
    key: string,
    extra: Partial<Column<Row, VNodeChild>> = {},
): Column<Row, VNodeChild> => ({
    key,
    name: key.toUpperCase(),
    width: 100,
    getValue: (row) => `${row.id}${key}`,
    ...extra,
});

/** "id"; "g" collapsible ("g0" both, "g1"–"g5" expanded, "sum" collapsed); "h" (h0, h1); 20 more */
const COLUMNS: ColumnOrGroup<Row, VNodeChild>[] = [
    column("id"),
    {
        key: "g",
        name: "G",
        collapsible: true,
        children: [
            column("g0"),
            ...[1, 2, 3, 4, 5].map((i) =>
                column(`g${i}`, { groupShow: "expanded" }),
            ),
            column("sum", { groupShow: "collapsed" }),
        ],
    },
    { key: "h", name: "H", children: [column("h0"), column("h1")] },
    ...Array.from({ length: 20 }, (_, i) => column(`c${i}`)),
];

stubViewportSize(400, 235);

/** A group's label and its toggle, as an app writes them. */
const GroupContent = defineComponent({
    props: {
        cell: {
            type: Object as PropType<HeaderCellInfo<Row>>,
            required: true,
        },
    },
    setup(props) {
        const { model } = useDataGrid<Row, Features>();
        const { state } = useHeaderCell(() => props.cell);
        const label = useGroupLabel(() => props.cell);
        return () =>
            h("span", label.props.value, [
                props.cell.group?.name,
                state.value.collapsed !== undefined
                    ? h(
                          "button",
                          {
                              type: "button",
                              "data-testid": `toggle-${props.cell.key}`,
                              "aria-expanded": !state.value.collapsed,
                              onClick: () =>
                                  model.run("column-groups.toggle", {
                                      groupKey: props.cell.key,
                                  }),
                          },
                          "±",
                      )
                    : null,
            ]);
    },
});

type GridProps = Pick<
    RootProps<Row, Features>,
    | "collapsedGroupKeys"
    | "defaultCollapsedGroupKeys"
    | "onCollapsedGroupKeysChange"
    | "maxScrollSize"
> & { table?: boolean };

function grid({ table = false, ...props }: GridProps = {}) {
    const tag = tags(table);
    return h(
        G.Root,
        {
            features: FEATURES,
            columns: COLUMNS,
            rows,
            rowHeight: 20,
            overscan: { columns: 1 },
            ...props,
        },
        {
            default: () => [
                h(
                    G.Grid,
                    { as: tag.grid },
                    {
                        default: () => [
                            h(
                                G.Header,
                                { as: tag.header },
                                {
                                    default: () => [
                                        h(G.HeaderRows, null, {
                                            default: ({
                                                row,
                                            }: {
                                                row: HeaderRowInfo<Row>;
                                            }) => [
                                                h(
                                                    G.HeaderRow,
                                                    {
                                                        row,
                                                        as: tag.headerRow,
                                                    },
                                                    {
                                                        default: () => [
                                                            h(
                                                                G.HeaderCells,
                                                                null,
                                                                {
                                                                    default: ({
                                                                        cell,
                                                                    }: {
                                                                        cell: HeaderCellInfo<Row>;
                                                                    }) => [
                                                                        h(
                                                                            G.HeaderCell,
                                                                            {
                                                                                cell,
                                                                                as: tag.headerCell,
                                                                            },
                                                                            cell.group
                                                                                ? {
                                                                                      default:
                                                                                          () => [
                                                                                              h(
                                                                                                  GroupContent,
                                                                                                  {
                                                                                                      cell,
                                                                                                  },
                                                                                              ),
                                                                                          ],
                                                                                  }
                                                                                : undefined,
                                                                        ),
                                                                    ],
                                                                },
                                                            ),
                                                        ],
                                                    },
                                                ),
                                            ],
                                        }),
                                    ],
                                },
                            ),
                            h(
                                G.Body,
                                { as: tag.body },
                                {
                                    default: () => [
                                        h(G.Rows, null, {
                                            default: ({
                                                row,
                                            }: {
                                                row: RowInfo<Row>;
                                            }) => [
                                                h(
                                                    G.Row,
                                                    { row, as: tag.row },
                                                    {
                                                        default: () => [
                                                            h(G.Cells, null, {
                                                                default: ({
                                                                    cell,
                                                                }: {
                                                                    cell: CellInfo<Row>;
                                                                }) => [
                                                                    h(G.Cell, {
                                                                        cell,
                                                                        as: tag.cell,
                                                                    }),
                                                                ],
                                                            }),
                                                        ],
                                                    },
                                                ),
                                            ],
                                        }),
                                    ],
                                },
                            ),
                        ],
                    },
                ),
            ],
        },
    );
}

/** The columns' header cells' text, in order. */
function columnRow(container: HTMLElement): string[] {
    return [
        ...container.querySelectorAll(
            '[data-grid-part="header-cell"]:not([data-group])',
        ),
    ].map((cell) => cell.textContent ?? "");
}

function groupCell(container: HTMLElement, key: string): HTMLElement {
    const toggle = container.querySelector(`[data-testid="toggle-${key}"]`);
    const cell = toggle?.closest('[data-grid-part="header-cell"]');
    if (!(cell instanceof HTMLElement)) throw new Error(`no group ${key}`);
    return cell;
}

async function toggle(container: HTMLElement, key: string) {
    const button = container.querySelector(`[data-testid="toggle-${key}"]`);
    if (!(button instanceof HTMLElement)) throw new Error(`no toggle ${key}`);
    click(button);
    await settled();
}

for (const table of [false, true]) {
    describe(table ? "as a table" : "as divs", () => {
        it("toggles a group from the app's control, its header cell telling it", async () => {
            const onCollapsedGroupKeysChange = vi.fn();
            const { container } = renderGrid(() =>
                grid({ table, onCollapsedGroupKeysChange }),
            );
            await settled();
            const g = groupCell(container, "g");
            expect(g).toHaveAttribute("data-collapsible", "");
            expect(g).not.toHaveAttribute("data-collapsed");
            expect(g).toHaveAttribute("aria-colspan", "6");
            expect(columnRow(container).slice(0, 3)).toEqual([
                "ID",
                "G0",
                "G1",
            ]);
            await toggle(container, "g");
            expect(onCollapsedGroupKeysChange).toHaveBeenCalledWith(["g"]);
            expect(g).toHaveAttribute("data-collapsed", "");
            expect(g).toHaveAttribute("aria-colspan", "2");
            if (table) expect(g).toHaveAttribute("colspan", "2");
            expect(columnRow(container).slice(0, 4)).toEqual([
                "ID",
                "G0",
                "SUM",
                "H0",
            ]);
            expect(cellAt(container, 0, 2)).toHaveTextContent("0sum");
            // a group that does not collapse says nothing
            const h = container.querySelector(
                '[data-grid-part="header-cell"][data-group][aria-colspan="2"]:not([data-collapsible])',
            );
            expect(h).toHaveTextContent("H");
        });
    });
}

describe("controlled or not", () => {
    it("starts collapsed, uncontrolled", async () => {
        const { container } = renderGrid(() =>
            grid({ defaultCollapsedGroupKeys: ["g"] }),
        );
        await settled();
        expect(groupCell(container, "g")).toHaveAttribute("data-collapsed");
        await toggle(container, "g");
        expect(groupCell(container, "g")).not.toHaveAttribute("data-collapsed");
    });

    it("asks a controlled parent, and follows its prop", async () => {
        const asked = vi.fn();
        const parent = (follow: boolean) => {
            const keys = shallowRef<readonly string[]>([]);
            return () =>
                grid({
                    collapsedGroupKeys: keys.value,
                    onCollapsedGroupKeysChange: (next) => {
                        asked(next);
                        if (follow) keys.value = next;
                    },
                });
        };
        const declined = renderGrid(parent(false));
        await settled();
        await toggle(declined.container, "g");
        expect(asked).toHaveBeenLastCalledWith(["g"]);
        expect(groupCell(declined.container, "g")).not.toHaveAttribute(
            "data-collapsed",
        );
        declined.unmount();
        const followed = renderGrid(parent(true));
        await settled();
        await toggle(followed.container, "g");
        expect(groupCell(followed.container, "g")).toHaveAttribute(
            "data-collapsed",
        );
    });

    it("takes the same keys in another order as no change", async () => {
        const onCollapsedGroupKeysChange = vi.fn();
        const keys = shallowRef<readonly string[]>(["g", "gone"]);
        const { container } = renderGrid(() =>
            grid({
                collapsedGroupKeys: keys.value,
                onCollapsedGroupKeysChange,
            }),
        );
        await settled();
        keys.value = ["gone", "g"];
        await settled();
        expect(onCollapsedGroupKeysChange).not.toHaveBeenCalled();
        expect(groupCell(container, "g")).toHaveAttribute("data-collapsed");
    });
});

describe("a group's label", () => {
    function label(container: HTMLElement): HTMLElement {
        const element = container.querySelector(
            '[data-grid-part="group-label"][data-grid-group-label="g"]',
        );
        if (!(element instanceof HTMLElement)) throw new Error("no label");
        return element;
    }

    it("is sticky, marked with its group's key, its inset the engine's", async () => {
        const { container } = renderGrid(() => grid());
        await settled();
        const element = label(container);
        expect(element.style.position).toBe("sticky");
        expect(element.style.left).toBe("0px");
    });

    it("stays at the view's start through a scroll, Vue rendering nothing", async () => {
        const { container, renders, resetRenders } = renderGrid(() => grid());
        await settled();
        const viewport = root(container);
        scrollRoot(viewport, { left: 300 });
        await settled();
        const at = label(container).style.left;
        resetRenders();
        // inside the overscan: no render, and the label's inset holds (sticky keeps it in place)
        for (const left of [310, 330, 350]) scrollRoot(viewport, { left });
        await settled();
        expect(renders()).toBe(0);
        expect(label(container).style.left).toBe(at);
    });

    it("follows every frame under scaled column scroll, Vue rendering nothing", async () => {
        const { container, renders, resetRenders } = renderGrid(() =>
            grid({ maxScrollSize: 1_200 }),
        );
        await settled();
        const viewport = root(container);
        // 2,800px in 1,200: "g" (100–700) scrolled partly out
        scrollRoot(viewport, { left: 100 });
        await settled();
        resetRenders();
        const insets = new Set<string>();
        for (const left of [101, 102, 103]) {
            scrollRoot(viewport, { left });
            insets.add(label(container).style.left);
        }
        await settled();
        expect(renders()).toBe(0);
        expect(insets.size).toBe(3);
    });
});
