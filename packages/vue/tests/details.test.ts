import { describe, expect, it, vi } from "vitest";
import {
    defineComponent,
    mergeProps,
    shallowRef,
    type VNode,
    type VNodeChild,
} from "vue";
import {
    type CellInfo,
    type Column,
    type RenderSlotProps,
    type RowDetailState,
    type RowInfo,
    type RowKey,
    type RowState,
    typedDataGrid,
    useDataGrid,
} from "../src";
import {
    click,
    FEATURES,
    type Features,
    h,
    renderGrid,
    settled,
    stubViewportSize,
    tags,
} from "./helpers";

// Row details (Epic #41, M1–M4): `Root` maps the expansion (controlled or not) and `detailHeight`
// onto the model; `DataGrid.RowDetail` renders inside its row, after its cells, only while the
// row is expanded: one cell spanning every column, sticky at the view's start (the engine writes
// its `left`), below the row's own height. A grid without expanded rows renders as before.

interface Row {
    id: string;
    total: number;
}

const G = typedDataGrid<Row, Features>();

const rows: Row[] = Array.from({ length: 50 }, (_, i) => ({
    id: `r${i}`,
    total: i,
}));

const columns: Column<Row, VNodeChild>[] = Array.from(
    { length: 6 },
    (_, i) => ({
        key: `c${i}`,
        name: `C${i}`,
        width: 100,
    }),
);

/** The structural style keys a detail may carry (AGENTS.md, the primitive contract). */
const DETAIL_STRUCTURAL = new Set([
    "position",
    "left",
    "display",
    "margin-top",
    "margin-left",
    "flex-shrink",
    "width",
    "height",
    "box-sizing",
]);

stubViewportSize(400, 235);

type GridProps = {
    table?: boolean;
    cells?: Column<Row, VNodeChild>[];
    expandedRowKeys?: readonly RowKey[];
    defaultExpandedRowKeys?: readonly RowKey[];
    onExpandedRowKeysChange?: (keys: readonly RowKey[]) => void;
    detailHeight?: number | ((row: Row) => number);
    /** the detail's attributes (`as`, `style`, ARIA, a template `ref`) */
    detail?: Record<string, unknown>;
    /** the detail's `render` slot */
    detailRender?: (scope: RenderSlotProps<RowDetailState>) => VNode[];
    withDetail?: boolean;
};

/** A button that toggles its row, as an app's expander cell would. */
const Toggle = defineComponent({
    props: { rowIndex: { type: Number, required: true } },
    setup(props) {
        const { model } = useDataGrid<Row, Features>();
        return () =>
            h("button", {
                type: "button",
                "data-testid": `toggle-${props.rowIndex}`,
                onClick: () =>
                    model.run("expanded-rows.toggle", {
                        rowIndex: props.rowIndex,
                    }),
            });
    },
});

function grid({
    table = false,
    cells = columns,
    withDetail = true,
    detail,
    detailRender,
    ...props
}: GridProps = {}) {
    const tag = tags(table);
    return h(
        G.Root,
        {
            features: FEATURES,
            columns: cells,
            rows,
            rowKey: (row: Row) => row.id,
            rowHeight: 20,
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
                                                    { row },
                                                    {
                                                        // React's className function: the state's class
                                                        render: ({
                                                            props: own,
                                                            state,
                                                            children,
                                                        }: RenderSlotProps<RowState>) => [
                                                            h(
                                                                tag.row ??
                                                                    "div",
                                                                mergeProps(
                                                                    own,
                                                                    {
                                                                        class: state.expanded
                                                                            ? "open"
                                                                            : undefined,
                                                                    },
                                                                ),
                                                                [h(children)],
                                                            ),
                                                        ],
                                                        default: () => [
                                                            h(G.Cells, null, {
                                                                default: ({
                                                                    cell,
                                                                }: {
                                                                    cell: CellInfo<Row>;
                                                                }) => [
                                                                    h(
                                                                        G.Cell,
                                                                        {
                                                                            cell,
                                                                            as: tag.cell,
                                                                        },
                                                                        {
                                                                            default:
                                                                                () => [
                                                                                    cell.columnIndex ===
                                                                                    0
                                                                                        ? h(
                                                                                              Toggle,
                                                                                              {
                                                                                                  rowIndex:
                                                                                                      cell.rowIndex,
                                                                                              },
                                                                                          )
                                                                                        : null,
                                                                                ],
                                                                        },
                                                                    ),
                                                                ],
                                                            }),
                                                            withDetail
                                                                ? h(
                                                                      G.RowDetail,
                                                                      {
                                                                          as: tag.cell,
                                                                          ...detail,
                                                                      },
                                                                      {
                                                                          ...(detailRender
                                                                              ? {
                                                                                    render: detailRender,
                                                                                }
                                                                              : {}),
                                                                          default:
                                                                              () => [
                                                                                  h(
                                                                                      "p",
                                                                                      {
                                                                                          "data-testid": `detail-${row.rowIndex}`,
                                                                                      },
                                                                                      row
                                                                                          .row
                                                                                          ?.id,
                                                                                  ),
                                                                              ],
                                                                      },
                                                                  )
                                                                : null,
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

const rowElement = (container: HTMLElement, rowIndex: number) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="row"][data-row-index="${rowIndex}"]`,
    );
const detailOf = (container: HTMLElement, rowIndex: number) =>
    container.querySelector<HTMLElement>(
        `[data-grid-part="row-detail"][data-row-index="${rowIndex}"]`,
    );
const byTestId = (container: HTMLElement, id: string) => {
    const element = container.querySelector(`[data-testid="${id}"]`);
    if (!(element instanceof HTMLElement)) throw new Error(`no ${id}`);
    return element;
};

describe("DataGrid.RowDetail", () => {
    it("renders nothing, and changes nothing, while no row is expanded", async () => {
        const { container } = renderGrid(() => grid());
        await settled();
        expect(
            container.querySelector('[data-grid-part="row-detail"]'),
        ).toBeNull();
        expect(container.querySelector("[data-expanded]")).toBeNull();
        const row = rowElement(container, 1);
        expect(row?.style.height).toBe("20px");
        const without = renderGrid(() => grid({ withDetail: false })).container;
        await settled();
        expect(rowElement(without, 1)?.getAttribute("style")).toBe(
            row?.getAttribute("style"),
        );
    });

    it("renders below its cells while the row is expanded, uncontrolled", async () => {
        const onChange = vi.fn();
        const { container } = renderGrid(() =>
            grid({ detailHeight: 100, onExpandedRowKeysChange: onChange }),
        );
        await settled();
        click(byTestId(container, "toggle-2"));
        await settled();
        expect(onChange).toHaveBeenLastCalledWith(["r2"]);
        const row = rowElement(container, 2);
        const detail = detailOf(container, 2);
        expect(row?.hasAttribute("data-expanded")).toBe(true);
        expect(row?.className).toBe("open");
        // the row's box holds its detail; its cells keep their own height
        expect(row?.style.height).toBe("120px");
        expect(
            row?.querySelector<HTMLElement>('[data-grid-part="cell"]')?.style
                .height,
        ).toBe("20px");
        expect(rowElement(container, 3)?.style.top).toBe("160px");
        // after its cells, in its row
        expect(row?.lastElementChild).toBe(detail);
        expect(detail?.textContent).toBe("r2");
        expect(detail?.style.position).toBe("sticky");
        expect(detail?.style.marginTop).toBe("20px");
        expect(detail?.style.width).toBe("400px");
        expect(detail?.style.height).toBe("100px");
        // the engine's inset: the view's start
        expect(detail?.style.left).toBe("0px");
        click(byTestId(container, "toggle-2"));
        await settled();
        expect(detailOf(container, 2)).toBeNull();
        expect(rowElement(container, 2)?.hasAttribute("data-expanded")).toBe(
            false,
        );
        expect(onChange).toHaveBeenLastCalledWith([]);
    });

    it("is one cell of its row spanning every column, with no row count change", async () => {
        const { container } = renderGrid(() =>
            grid({ defaultExpandedRowKeys: ["r1"] }),
        );
        await settled();
        const gridElement = container.querySelector('[data-grid-part="grid"]');
        const detail = detailOf(container, 1);
        expect(detail?.getAttribute("role")).toBe("gridcell");
        expect(detail?.getAttribute("aria-colindex")).toBe("1");
        expect(detail?.getAttribute("aria-colspan")).toBe("6");
        expect(detail?.hasAttribute("data-column-index")).toBe(false);
        expect(detail?.hasAttribute("aria-label")).toBe(false);
        expect(gridElement?.getAttribute("aria-rowcount")).toBe("51");
        // the header row first: row 2 is the fourth, as without a detail
        expect(rowElement(container, 2)?.getAttribute("aria-rowindex")).toBe(
            "4",
        );
    });

    it("follows the controlled keys, and asks for a toggle", async () => {
        const keys = shallowRef<readonly RowKey[]>(["r0"]);
        const { container } = renderGrid(() =>
            grid({
                expandedRowKeys: keys.value,
                onExpandedRowKeysChange: (next) => {
                    keys.value = next;
                },
            }),
        );
        await settled();
        expect(detailOf(container, 0)).not.toBeNull();
        click(byTestId(container, "toggle-3"));
        await settled();
        expect(detailOf(container, 3)).not.toBeNull();
        click(byTestId(container, "toggle-0"));
        await settled();
        expect(detailOf(container, 0)).toBeNull();
    });

    it("stays as the parent holds it when the parent declines", async () => {
        const onChange = vi.fn();
        const { container } = renderGrid(() =>
            grid({ expandedRowKeys: [], onExpandedRowKeysChange: onChange }),
        );
        await settled();
        click(byTestId(container, "toggle-1"));
        await settled();
        expect(onChange).toHaveBeenCalledWith(["r1"]);
        expect(detailOf(container, 1)).toBeNull();
    });

    it("takes its height from its row", async () => {
        const { container } = renderGrid(() =>
            grid({
                defaultExpandedRowKeys: ["r4"],
                detailHeight: (row) => 50 + row.total,
            }),
        );
        await settled();
        expect(detailOf(container, 4)?.style.height).toBe("54px");
        expect(rowElement(container, 4)?.style.height).toBe("74px");
    });

    // React's `ref` prop merging and `className`/`style` functions have no Vue form: the `render`
    // slot binds the primitive's ref with the app's own on its element, and gives the state's
    // class; the style is a value
    it("follows the primitive contract: render, ref, className and style functions", async () => {
        let element: unknown = null;
        const { container } = renderGrid(() =>
            grid({
                table: true,
                defaultExpandedRowKeys: ["r1"],
                detail: {
                    style: {
                        left: "99px",
                        top: "5px",
                        marginTop: "1px",
                        color: "red",
                    },
                    "aria-label": "details",
                },
                detailRender: ({ props, state, children }) => {
                    const own = props.ref as (value: unknown) => void;
                    return [
                        h(
                            "td",
                            {
                                ...mergeProps(props, {
                                    class: `d${state.height}`,
                                }),
                                ref: (value: unknown) => {
                                    own(value);
                                    element = value;
                                },
                            },
                            [h(children)],
                        ),
                    ];
                },
                detailHeight: 80,
            }),
        );
        await settled();
        const detail = detailOf(container, 1);
        expect(detail?.tagName).toBe("TD");
        expect(detail?.getAttribute("colspan")).toBe("6");
        expect(element).toBe(detail);
        expect(detail?.className).toBe("d80");
        expect(detail?.getAttribute("aria-label")).toBe("details");
        // structural keys win, the engine's inset stays, the consumer's colour is merged in
        expect(detail?.style.marginTop).toBe("20px");
        expect(detail?.style.left).toBe("0px");
        expect(detail?.style.top).toBe("");
        expect(detail?.style.color).toBe("red");
        expect(detail?.style.display).toBe("block");
    });

    it("applies only structural inline style, pinned columns too", async () => {
        const pinnedColumns: Column<Row, VNodeChild>[] = columns.map(
            (column, i) => (i === 0 ? { ...column, pinned: "start" } : column),
        );
        for (const cells of [columns, pinnedColumns]) {
            const { container, unmount } = renderGrid(() =>
                grid({ cells, defaultExpandedRowKeys: ["r1"] }),
            );
            await settled();
            const detail = detailOf(container, 1);
            expect(detail).not.toBeNull();
            for (const property of Array.from(detail?.style ?? [])) {
                expect(DETAIL_STRUCTURAL.has(property), property).toBe(true);
            }
            if (cells === pinnedColumns) {
                // from the row's start, before the pinned cells, never shrunk by the flex row
                expect(detail?.style.marginLeft).toBe("-100px");
                expect(detail?.style.flexShrink).toBe("0");
            } else {
                expect(detail?.style.marginLeft).toBe("");
            }
            unmount();
        }
    });

    it("leaves the grid's keys alone inside a detail", async () => {
        const { container } = renderGrid(() =>
            grid({ defaultExpandedRowKeys: ["r0"] }),
        );
        await settled();
        const cell = container.querySelector<HTMLElement>(
            '[data-row-index="1"][data-column-index="1"]',
        );
        cell?.focus();
        await settled();
        const inside = container.querySelector<HTMLElement>(
            '[data-testid="detail-0"]',
        );
        const event = new KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
        });
        inside?.dispatchEvent(event);
        await settled();
        expect(event.defaultPrevented).toBe(false);
        expect(
            container
                .querySelector('[data-active][data-grid-part="cell"]')
                ?.getAttribute("data-row-index"),
        ).toBe("1");
    });
});
