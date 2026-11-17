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
    type ColumnOrder,
    type ColumnOrGroup,
    type ColumnWidths,
    type DataGridEngine,
    type DataGridFeatures,
    type DataGridModel,
    type DetailHeight,
    type EditDraft,
    type EditingCell,
    type GridDirection,
    type GridRoot,
    type GridRootProps,
    type GridView,
    type RowHeight,
    type RowKey,
    type RowKeyGetter,
    type RowMetaGetter,
    type RowMove,
    rootPropsOf,
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

/** The root's props as it hands them to the core: a grid of any features. */
type RootProps<TRow> = GridRootProps<TRow, DataGridNode, DataGridFeatures>;

/** The root's state (React's `RootState`): none of its own. */
export type RootState = Record<string, never>;

/**
 * The root props another directive on the root's element gives it (`[dataGridLocalRows]`,
 * `[dataGridSorting]`), typed by the features whose props it gives (`TFeatures`).
 */
export type RootPropsSource<
    TRow,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> = () => Partial<GridRootProps<TRow, DataGridNode, TFeatures>>;

/** How a source's props stand to the root's inputs and the other sources'. */
export interface RootPropsSourceOptions {
    /**
     * the props are inputs of the root's (a feature's: `[dataGridSorting]`): the other sources
     * win over them, as over the root's own. Left out, the source wins over the inputs
     * (`[dataGridLocalRows]`)
     */
    readonly inputs?: boolean | undefined;
}

/**
 * The grid's root: put it on the scroll container (`<div dataGridRoot [rows]="rows"
 * [columns]="columns">`, overflow auto: give it a size). It holds the model and the engine, maps
 * its inputs onto the model's commands (controlled or not: the core's `bindGridRoot`, after every
 * render), tells what changed through its outputs, and runs the grid's keys, clicks, presses and
 * clipboard events after the consumer's own listeners on its element, so `preventDefault` cancels
 * one. Each `onXChange` of React is the output `xChange` (`[(editingCell)]` binds both ways);
 * the row moves are on while `reorderableRows` is. It installs its `features` (`[navigation(),
 * sorting()]`, fixed when it is created: a later list is told in the console, never taken); a
 * feature's inputs are another directive's on the same element, from the feature's entry point
 * (`[dataGridNavigation]`, `[dataGridSorting]`, …).
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
    readonly editingCell = input<EditingCell | null | undefined>(undefined);
    readonly defaultEditingCell = input<EditingCell | null | undefined>(
        undefined,
    );
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
    readonly endReachedThreshold = input<number | undefined>(undefined);
    readonly overscan = input<{ rows?: number; columns?: number } | undefined>(
        undefined,
    );
    readonly maxScrollSize = input<number | undefined>(undefined);
    readonly direction = input<GridDirection | undefined>(undefined);
    readonly ownTabStop = input(undefined, { transform: optionalBoolean });
    /**
     * the features the grid installs (`[sorting()]`), fixed when it is created: a list given
     * later is told in the console, never taken. A feature not installed is not in the bundle
     */
    readonly features = input<DataGridFeatures | undefined>(undefined);
    /**
     * a handle on this grid from outside the root (`createDataGridRef()`): its model and engine,
     * and the injection functions that take it
     */
    readonly gridRef = input<DataGridRef<TRow> | undefined>(undefined);

    readonly expandedRowKeysChange = output<readonly RowKey[]>();
    readonly expandedGroupKeysChange = output<readonly RowKey[]>();
    readonly editingCellChange = output<EditingCell | null>();
    /** an edit committed (Epic #88): the cell, its value and its row */
    readonly cellEdit = output<CellEditEvent<TRow>>();
    readonly columnWidthsChange = output<ColumnWidths>();
    readonly columnOrderChange = output<ColumnOrder>();
    readonly collapsedGroupKeysChange = output<readonly string[]>();
    /** a row moved (Epic #86), while `reorderableRows`: the app moves its rows */
    readonly rowMove = output<RowMove>();
    readonly rowWindowChange = output<AxisWindow>();
    readonly columnWindowChange = output<AxisWindow>();
    readonly rowsEndReached = output<{ rowCount: number }>();

    private readonly host = injectHost();
    private readonly sources = signal<
        readonly {
            readonly source: RootPropsSource<TRow>;
            readonly inputs: boolean;
        }[]
    >([]);
    private bound: GridRoot<TRow, DataGridNode, DataGridFeatures> | undefined;
    /** bumped whenever the engine reports a new view */
    private readonly viewTick = signal(0);
    private readonly draftTick = signal(0);

    /** The root's props now: its inputs, the outputs as handlers, and the other sources'. */
    private props(): RootProps<TRow> {
        const own: RootProps<TRow> = {
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
            expandedRowKeys: this.expandedRowKeys(),
            defaultExpandedRowKeys: this.defaultExpandedRowKeys(),
            onExpandedRowKeysChange: this.handlers.expandedRowKeys,
            expandedGroupKeys: this.expandedGroupKeys(),
            defaultExpandedGroupKeys: this.defaultExpandedGroupKeys(),
            onExpandedGroupKeysChange: this.handlers.expandedGroupKeys,
            detailHeight: this.detailHeight(),
            estimatedDetailHeight: this.estimatedDetailHeight(),
            editingCell: this.editingCell(),
            defaultEditingCell: this.defaultEditingCell(),
            onEditingCellChange: this.handlers.editingCell,
            onCellEdit: this.handlers.cellEdit,
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
            features: this.features(),
        };
        // the features' inputs first, as the root's own; the other sources over them
        const sources = this.sources();
        let props = own;
        for (const inputs of [true, false]) {
            for (const entry of sources) {
                if (entry.inputs !== inputs) continue;
                props = {
                    ...props,
                    ...this.rendering(entry.source()),
                } as RootProps<TRow>;
            }
        }
        return props;
    }

    /**
     * Another source's props, its callbacks rendering what they changed before the next event, as
     * the outputs' handlers do (`[dataGridLocalRows]`' sort: a second click on a header reads the
     * rows the first one sorted). Each callback is wrapped once, for as long as the source gives it.
     */
    private rendering(
        props: Partial<RootProps<TRow>>,
    ): Partial<RootProps<TRow>> {
        const wrapped: Record<string, unknown> = { ...props };
        for (const [key, value] of Object.entries(props)) {
            if (!key.startsWith("on") || typeof value !== "function") continue;
            let render = this.renderingCallbacks.get(value);
            if (!render) {
                render = (...args: unknown[]) => {
                    const result = (value as (...a: unknown[]) => unknown)(
                        ...args,
                    );
                    this.renderSoon();
                    return result;
                };
                this.renderingCallbacks.set(value, render);
            }
            wrapped[key] = render;
        }
        return wrapped as Partial<RootProps<TRow>>;
    }

    private readonly renderingCallbacks = new WeakMap<
        object,
        (...args: unknown[]) => unknown
    >();

    /**
     * The outputs as the root's handlers: one function each, for the directive's life. What the
     * app keeps from them (a controlled piece, its rows) is rendered before the next event, as
     * React renders a discrete event's change at once: a key pressed meanwhile would start from
     * the value the app has not handed back yet (the active cell two arrows down would move one),
     * or move rows not moved yet.
     */
    private readonly handlers = {
        expandedRowKeys: this.emitting(this.expandedRowKeysChange),
        expandedGroupKeys: this.emitting(this.expandedGroupKeysChange),
        editingCell: this.emitting(this.editingCellChange),
        cellEdit: this.emitting(this.cellEdit),
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
    private get root(): GridRoot<TRow, DataGridNode, DataGridFeatures> {
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
    get model(): DataGridModel<TRow, DataGridNode, DataGridFeatures> {
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

    /**
     * Another source of root props (`[dataGridLocalRows]`, a feature's inputs: `[dataGridSorting]`),
     * until the returned stop. Its callbacks render what they changed before the next event, as
     * the outputs do.
     */
    addPropsSource<TFeatures extends DataGridFeatures = DataGridFeatures>(
        source: RootPropsSource<TRow, TFeatures>,
        options?: RootPropsSourceOptions,
    ): () => void {
        const entry = {
            // a feature's props, read by the core only when that feature is installed
            source: source as unknown as RootPropsSource<TRow>,
            inputs: options?.inputs ?? false,
        };
        this.sources.update((sources) => [...sources, entry]);
        return () =>
            this.sources.update((sources) =>
                sources.filter((other) => other !== entry),
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
