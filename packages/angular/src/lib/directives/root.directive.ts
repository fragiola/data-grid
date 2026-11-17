import {
    ApplicationRef,
    afterNextRender,
    afterRenderEffect,
    computed,
    Directive,
    effect,
    forwardRef,
    inject,
    input,
    type OutputEmitterRef,
    output,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import {
    type AxisWindow,
    bindGridRoot,
    type CellEditEvent,
    type CellPosition,
    type CellRange,
    type CellSelection,
    type ColumnOrder,
    type ColumnOrGroup,
    type ColumnWidths,
    type DataGridEngine,
    type DataGridModel,
    type DetailHeight,
    type EditDraft,
    type EditingCell,
    type GridDirection,
    type GridRoot,
    type GridRootProps,
    type GridView,
    type RangeFill,
    type RangePaste,
    type RowHeight,
    type RowKey,
    type RowKeyGetter,
    type RowMetaGetter,
    type RowMove,
    type RowSelectable,
    type RowSelection,
    rootPropsOf,
    type SortColumn,
} from "@fragiola/data-grid";
import {
    DATA_GRID_HEADER_ROW,
    DATA_GRID_ROW,
    DATA_GRID_SUMMARY,
    DATA_GRID_SUMMARY_ROW,
    type DataGridContextValue,
    type DataGridRef,
    GRID_CONTEXT,
} from "../context";
import { attachGridRef } from "../inject/create-data-grid-ref";
import type { DataGridNode } from "../utils/content";
import {
    bindPart,
    injectHost,
    onDestroy,
    optionalBoolean,
} from "../utils/helpers";

/** The root's state (React's `RootState`): none of its own. */
export type RootState = Record<string, never>;

/**
 * The root props another directive on the root's element gives it (`[dataGridLocalRows]`): they
 * win over the root's own inputs.
 */
export type RootPropsSource<TRow> = () => Partial<
    GridRootProps<TRow, DataGridNode>
>;

/**
 * The grid's root: put it on the scroll container (`<div dataGridRoot [rows]="rows"
 * [columns]="columns">`, overflow auto: give it a size). It holds the model and the engine, maps
 * its inputs onto the model's commands (controlled or not: the core's `bindGridRoot`, after every
 * render), tells what changed through its outputs, and runs the grid's keys, clicks, presses and
 * clipboard events after the consumer's own listeners on its element, so `preventDefault` cancels
 * one. Each `onXChange` of React is the output `xChange` (`[(sortColumns)]` binds both ways); the
 * row moves and the fill are on while `reorderableRows` and `fillable` are.
 */
@Directive({
    selector: "[dataGridRoot]",
    exportAs: "dataGridRoot",
    providers: [
        { provide: GRID_CONTEXT, useExisting: forwardRef(() => DataGridRoot) },
        // a grid nested in a cell of another one is not in the outer one's rows
        { provide: DATA_GRID_ROW, useValue: null },
        { provide: DATA_GRID_HEADER_ROW, useValue: null },
        { provide: DATA_GRID_SUMMARY, useValue: null },
        { provide: DATA_GRID_SUMMARY_ROW, useValue: null },
    ],
})
// provided as the parts' `GridContext` (its row type erased: a part reads any row)
export class DataGridRoot<TRow = unknown> {
    /** the columns, and the groups above them (nested to any depth) */
    readonly columns =
        input.required<readonly ColumnOrGroup<TRow, DataGridNode>[]>();
    /** every row (fixed, or growing for infinite loading); or `rowCount` and `getRow` */
    readonly rows = input<readonly TRow[] | undefined>(undefined);
    /** how many rows the grid represents, loaded or not (with `getRow`) */
    readonly rowCount = input<number | undefined>(undefined);
    /** the row at an index, or `undefined` while it is not loaded */
    readonly getRow = input<((index: number) => TRow | undefined) | undefined>(
        undefined,
    );
    /** what kind of row an index is (Epic #87): a group row, a data row at a depth */
    readonly getRowMeta = input<RowMetaGetter | undefined>(undefined);
    /** a row's key; without one, rows are keyed by their index */
    readonly rowKey = input<RowKeyGetter<TRow> | undefined>(undefined);
    readonly rowHeight = input<RowHeight | undefined>(undefined);
    readonly estimatedRowHeight = input<number | undefined>(undefined);
    readonly headerRowHeight = input<number | undefined>(undefined);
    readonly summaryRows = input<
        { readonly top?: number; readonly bottom?: number } | undefined
    >(undefined);
    readonly summaryRowHeight = input<number | undefined>(undefined);
    readonly activePosition = input<CellPosition | null | undefined>(undefined);
    readonly defaultActivePosition = input<CellPosition | null | undefined>(
        undefined,
    );
    readonly sortColumns = input<readonly SortColumn[] | undefined>(undefined);
    readonly defaultSortColumns = input<readonly SortColumn[] | undefined>(
        undefined,
    );
    readonly expandedRowKeys = input<readonly RowKey[] | undefined>(undefined);
    readonly defaultExpandedRowKeys = input<readonly RowKey[] | undefined>(
        undefined,
    );
    readonly expandedGroupKeys = input<readonly RowKey[] | undefined>(
        undefined,
    );
    readonly defaultExpandedGroupKeys = input<readonly RowKey[] | undefined>(
        undefined,
    );
    readonly detailHeight = input<DetailHeight<TRow> | undefined>(undefined);
    readonly estimatedDetailHeight = input<number | undefined>(undefined);
    readonly rowSelection = input<RowSelection | undefined>(undefined);
    readonly isRowSelectable = input<RowSelectable<TRow> | undefined>(
        undefined,
    );
    readonly selectedRowKeys = input<readonly RowKey[] | undefined>(undefined);
    readonly defaultSelectedRowKeys = input<readonly RowKey[] | undefined>(
        undefined,
    );
    readonly editingCell = input<EditingCell | null | undefined>(undefined);
    readonly defaultEditingCell = input<EditingCell | null | undefined>(
        undefined,
    );
    readonly cellSelection = input<CellSelection | undefined>(undefined);
    readonly selectedRange = input<CellRange | null | undefined>(undefined);
    readonly defaultSelectedRange = input<CellRange | null | undefined>(
        undefined,
    );
    /** asked before a paste is told (`rangePaste`): `false` refuses it */
    readonly beforeRangePaste = input<
        ((paste: RangePaste) => boolean | undefined) | undefined
    >(undefined);
    readonly columnWidths = input<ColumnWidths | undefined>(undefined);
    readonly defaultColumnWidths = input<ColumnWidths | undefined>(undefined);
    readonly columnOrder = input<ColumnOrder | undefined>(undefined);
    readonly defaultColumnOrder = input<ColumnOrder | undefined>(undefined);
    readonly collapsedGroupKeys = input<readonly string[] | undefined>(
        undefined,
    );
    readonly defaultCollapsedGroupKeys = input<readonly string[] | undefined>(
        undefined,
    );
    /** the rows move by drag and keys (React: `onRowMove` given): told by `rowMove` */
    readonly reorderableRows = input(undefined, { transform: optionalBoolean });
    /** the fill handle fills cells (React: `onFill` given): told by `fill` */
    readonly fillable = input(undefined, { transform: optionalBoolean });
    readonly endReachedThreshold = input<number | undefined>(undefined);
    readonly overscan = input<{ rows?: number; columns?: number } | undefined>(
        undefined,
    );
    readonly maxScrollSize = input<number | undefined>(undefined);
    readonly direction = input<GridDirection | undefined>(undefined);
    readonly ownTabStop = input(undefined, { transform: optionalBoolean });
    /**
     * a handle on this grid from outside the root (`createDataGridRef()`): its model and engine,
     * and the injection functions that take it
     */
    readonly gridRef = input<DataGridRef<TRow> | undefined>(undefined);

    readonly activePositionChange = output<CellPosition | null>();
    readonly sortColumnsChange = output<readonly SortColumn[]>();
    readonly expandedRowKeysChange = output<readonly RowKey[]>();
    readonly expandedGroupKeysChange = output<readonly RowKey[]>();
    readonly selectedRowKeysChange = output<readonly RowKey[]>();
    readonly editingCellChange = output<EditingCell | null>();
    /** an edit committed (Epic #88): the cell, its value and its row */
    readonly cellEdit = output<CellEditEvent<TRow>>();
    readonly selectedRangeChange = output<CellRange | null>();
    /** a paste over the range (Epic #88), once `beforeRangePaste` let it */
    readonly rangePaste = output<RangePaste>();
    /** a fill (Epic #88), while `fillable` */
    readonly fill = output<RangeFill>();
    readonly columnWidthsChange = output<ColumnWidths>();
    readonly columnOrderChange = output<ColumnOrder>();
    readonly collapsedGroupKeysChange = output<readonly string[]>();
    /** a row moved (Epic #86), while `reorderableRows`: the app moves its rows */
    readonly rowMove = output<RowMove>();
    readonly rowWindowChange = output<AxisWindow>();
    readonly columnWindowChange = output<AxisWindow>();
    readonly rowsEndReached = output<{ rowCount: number }>();

    private readonly host = injectHost();
    private readonly sources = signal<readonly RootPropsSource<TRow>[]>([]);
    private bound: GridRoot<TRow, DataGridNode> | undefined;
    /** bumped whenever the engine reports a new view */
    private readonly viewTick = signal(0);
    private readonly draftTick = signal(0);

    /** The root's props now: its inputs, the outputs as handlers, and the other sources'. */
    private props(): GridRootProps<TRow, DataGridNode> {
        const own: GridRootProps<TRow, DataGridNode> = {
            columns: this.columns(),
            ...(this.rows() !== undefined
                ? { rows: this.rows() as readonly TRow[] }
                : {
                      rowCount: this.rowCount() ?? 0,
                      getRow: this.getRow() ?? noRow,
                  }),
            getRowMeta: this.getRowMeta(),
            rowKey: this.rowKey(),
            rowHeight: this.rowHeight(),
            estimatedRowHeight: this.estimatedRowHeight(),
            headerRowHeight: this.headerRowHeight(),
            summaryRows: this.summaryRows(),
            summaryRowHeight: this.summaryRowHeight(),
            activePosition: this.activePosition(),
            defaultActivePosition: this.defaultActivePosition(),
            onActivePositionChange: this.handlers.activePosition,
            sortColumns: this.sortColumns(),
            defaultSortColumns: this.defaultSortColumns(),
            onSortColumnsChange: this.handlers.sortColumns,
            expandedRowKeys: this.expandedRowKeys(),
            defaultExpandedRowKeys: this.defaultExpandedRowKeys(),
            onExpandedRowKeysChange: this.handlers.expandedRowKeys,
            expandedGroupKeys: this.expandedGroupKeys(),
            defaultExpandedGroupKeys: this.defaultExpandedGroupKeys(),
            onExpandedGroupKeysChange: this.handlers.expandedGroupKeys,
            detailHeight: this.detailHeight(),
            estimatedDetailHeight: this.estimatedDetailHeight(),
            rowSelection: this.rowSelection(),
            isRowSelectable: this.isRowSelectable(),
            selectedRowKeys: this.selectedRowKeys(),
            defaultSelectedRowKeys: this.defaultSelectedRowKeys(),
            onSelectedRowKeysChange: this.handlers.selectedRowKeys,
            editingCell: this.editingCell(),
            defaultEditingCell: this.defaultEditingCell(),
            onEditingCellChange: this.handlers.editingCell,
            onCellEdit: this.handlers.cellEdit,
            cellSelection: this.cellSelection(),
            selectedRange: this.selectedRange(),
            defaultSelectedRange: this.defaultSelectedRange(),
            onSelectedRangeChange: this.handlers.selectedRange,
            onRangePaste: this.handlers.rangePaste,
            onBeforeRangePaste: this.beforeRangePaste(),
            onFill: this.fillable() ? this.handlers.fill : undefined,
            columnWidths: this.columnWidths(),
            defaultColumnWidths: this.defaultColumnWidths(),
            onColumnWidthsChange: this.handlers.columnWidths,
            columnOrder: this.columnOrder(),
            defaultColumnOrder: this.defaultColumnOrder(),
            onColumnOrderChange: this.handlers.columnOrder,
            collapsedGroupKeys: this.collapsedGroupKeys(),
            defaultCollapsedGroupKeys: this.defaultCollapsedGroupKeys(),
            onCollapsedGroupKeysChange: this.handlers.collapsedGroupKeys,
            onRowMove: this.reorderableRows()
                ? this.handlers.rowMove
                : undefined,
            onRowWindowChange: this.handlers.rowWindow,
            onColumnWindowChange: this.handlers.columnWindow,
            onRowsEndReached: this.handlers.rowsEndReached,
            endReachedThreshold: this.endReachedThreshold(),
            overscan: this.overscan(),
            maxScrollSize: this.maxScrollSize(),
            direction: this.direction(),
            ownTabStop: this.ownTabStop(),
        };
        let props = own;
        for (const source of this.sources()) {
            props = { ...props, ...source() } as GridRootProps<
                TRow,
                DataGridNode
            >;
        }
        return props;
    }

    /**
     * The outputs as the root's handlers: one function each, for the directive's life. What the
     * app keeps from them (a controlled piece, its rows) is rendered before the next event, as
     * React renders a discrete event's change at once: a key pressed meanwhile would start from
     * the value the app has not handed back yet (the active cell two arrows down would move one),
     * or move rows not moved yet.
     */
    private readonly handlers = {
        activePosition: this.emitting(this.activePositionChange),
        sortColumns: this.emitting(this.sortColumnsChange),
        expandedRowKeys: this.emitting(this.expandedRowKeysChange),
        expandedGroupKeys: this.emitting(this.expandedGroupKeysChange),
        selectedRowKeys: this.emitting(this.selectedRowKeysChange),
        editingCell: this.emitting(this.editingCellChange),
        cellEdit: this.emitting(this.cellEdit),
        selectedRange: this.emitting(this.selectedRangeChange),
        rangePaste: this.emitting(this.rangePaste),
        fill: this.emitting(this.fill),
        columnWidths: this.emitting(this.columnWidthsChange),
        columnOrder: this.emitting(this.columnOrderChange),
        collapsedGroupKeys: this.emitting(this.collapsedGroupKeysChange),
        rowMove: this.emitting(this.rowMove),
        rowWindow: (value: AxisWindow) => this.rowWindowChange.emit(value),
        columnWindow: (value: AxisWindow) =>
            this.columnWindowChange.emit(value),
        rowsEndReached: (value: { rowCount: number }) =>
            this.rowsEndReached.emit(value),
    };

    /** A handler emitting `output`, then rendering what the app did with it before the next event. */
    private emitting<T>(output: OutputEmitterRef<T>): (value: T) => void {
        return (value) => {
            output.emit(value);
            this.renderSoon();
        };
    }

    /**
     * The model and engine, made from the inputs the first time they are needed (a part reads
     * them in its computeds and effects, which run once the inputs are set).
     */
    private get root(): GridRoot<TRow, DataGridNode> {
        if (!this.bound) {
            const root = untracked(() => bindGridRoot(() => this.props()));
            this.bound = root;
            const stopView = root.engine.adapter.subscribe(() => {
                this.viewTick.update((n) => n + 1);
                this.renderSoon();
            });
            const stopDraft = root.engine.subscribe("edit-draft", () => {
                this.draftTick.update((n) => n + 1);
                this.renderSoon();
            });
            this.teardown.push(stopView, stopDraft);
        }
        return this.bound;
    }

    private readonly teardown: (() => void)[] = [];

    private readonly appRef = inject(ApplicationRef);
    private renderQueued = false;

    /**
     * Renders a new view, a draft or the app's moved rows in a microtask, before the next event
     * (React renders a discrete event's change at once, Vue on its next tick): zoneless Angular
     * would wait for its next frame or timer, and a key typed meanwhile would reach an editor not
     * rendered yet, one reading the draft before it, or rows not moved yet.
     */
    private renderSoon() {
        if (this.renderQueued) return;
        this.renderQueued = true;
        queueMicrotask(() => {
            this.renderQueued = false;
            if (!this.appRef.destroyed) this.appRef.tick();
        });
    }

    /** The grid's model: its data, its rules and its commands. */
    get model(): DataGridModel<TRow, DataGridNode> {
        return this.root.model;
    }

    /** The grid's engine: the grid on screen. */
    get engine(): DataGridEngine<TRow, DataGridNode> {
        return this.root.engine;
    }

    /** The view: a part follows it (a new window, new sizes), never a scroll frame (D9). */
    readonly view: Signal<GridView<TRow, DataGridNode>> = computed(() => {
        this.viewTick();
        return this.engine.adapter.getView();
    });

    /** The edit's draft (Epic #88). */
    readonly draft: Signal<EditDraft | null> = computed(() => {
        this.draftTick();
        return this.engine.get("edit-draft");
    });

    constructor() {
        bindPart(
            () => this.engine as DataGridEngine<unknown, DataGridNode>,
            this.host,
            () => ({ props: rootPropsOf(this.view()) }),
        );
        // the components that follow the ref (injectRowWindow(gridRef), …) are told
        effect((onCleanup) => {
            const gridRef = this.gridRef();
            if (!gridRef) return;
            const grid = untracked(
                (): DataGridContextValue<TRow> => ({
                    model: this.model,
                    engine: this.engine,
                }),
            );
            onCleanup(attachGridRef(gridRef, grid));
        });
        // once the element is in the page (the first render done, the parts registered): the
        // engine attaches to it, and its keys, clicks, presses and clipboard events, after the
        // consumer's listeners on it (registered before, at the element's creation)
        afterNextRender({
            earlyRead: () => {
                const { host } = this;
                const { adapter } = this.engine;
                const detach = adapter.attach(host);
                const listeners = [
                    listen(host, "keydown", (event: KeyboardEvent) =>
                        adapter.keydown(event),
                    ),
                    listen(host, "click", (event: MouseEvent) =>
                        adapter.click(event),
                    ),
                    listen(host, "pointerdown", (event: PointerEvent) =>
                        adapter.pointerdown(event),
                    ),
                    listen(host, "copy", (event: ClipboardEvent) =>
                        adapter.copy(event),
                    ),
                    listen(host, "paste", (event: ClipboardEvent) =>
                        adapter.paste(event),
                    ),
                ];
                this.teardown.push(detach, ...listeners);
            },
        });
        // after every render that changed an input or the view (the grid's commit done): the
        // inputs follow onto the model (each group only when one of its props changed), the
        // controlled pieces settle, and the engine takes its options
        afterRenderEffect({
            mixedReadWrite: () => {
                this.view();
                this.props();
                untracked(() => this.root.sync());
            },
        });
        onDestroy(() => {
            for (const stop of this.teardown.splice(0).reverse()) stop();
        });
    }

    /** Another source of root props (`[dataGridLocalRows]`), until the returned stop. */
    addPropsSource(source: RootPropsSource<TRow>): () => void {
        this.sources.update((sources) => [...sources, source]);
        return () =>
            this.sources.update((sources) =>
                sources.filter((other) => other !== source),
            );
    }
}

/** No row loaded: `getRow` without one. */
const noRow = (): undefined => undefined;

/** Adds a listener, and returns its removal. */
function listen<E extends Event>(
    element: HTMLElement,
    type: string,
    listener: (event: E) => void,
): () => void {
    const handler = listener as EventListener;
    element.addEventListener(type, handler);
    return () => element.removeEventListener(type, handler);
}
