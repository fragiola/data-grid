import type { ControlledProp } from "../adapter/controlled";
import type { GridCellInfo } from "../adapter/props";
import type { Axis } from "../axis/axis";
import type { DragEnd, FeatureDrag } from "../engine/drag";
import type { CellShare, HeaderCellState, RowShare } from "../engine/parts";
import type {
    DataGridEngine,
    DataGridEngineOptions,
    EditDraft,
    GridView,
} from "../engine/types";
import type { ColumnArrangement as ColumnArrangementOf } from "../header/header";
import type { DataGridModel } from "../model/model";
import type {
    CellKeys,
    CellPosition,
    Column,
    ColumnWidths,
    CommandResult,
    DataGridState,
    EditCellRenderProps,
    GridDirection,
    HeaderCellLayout,
    PinnedSide,
    RowMeta,
} from "../model/types";
import type { Direction } from "../navigation/navigation";
import type { Range } from "../viewport/window";

// The feature contract (Epic #141): a minimal core, and every optional capability a feature the
// app installs on its grid, once, at creation (`features: [sorting()]`). A feature is a plain
// object a factory makes, exported from its own entry point (`@fragiola/data-grid/sorting`), so
// a feature that is not imported is not in the app's bundle. The core composes what each one
// contributes once (`registry.ts`); features read each other only through keys.

/**
 * A feature's types: what it adds to the grid's, the way an installed feature's keys and props
 * are typed. A member may read the grid's row and node types through `this["row"]` and
 * `this["node"]`, bound to the grid's once installed (at the member's own level:
 * `readonly props: MyProps<this["row"]>`). Each member left out adds nothing.
 */
export interface FeatureTypes {
    /** the grid's row type, bound when the feature is installed (`this["row"]`) */
    readonly row: unknown;
    /** the grid's node type (what renderers return), bound the same way */
    readonly node: unknown;
    /** its slice of the model's state */
    readonly state: object;
    /** what `createDataGridModel` takes for it */
    readonly options: object;
    /** its commands (`run`, `can`, `check`): each name's `payload` and `result` */
    readonly commands: object;
    /** its `get` keys: each key's `payload` and `result` */
    readonly queries: object;
    /** its `is` keys: each key's payload */
    readonly questions: object;
    /** the props it adds to a root (`DataGrid.Root`), controlled or not */
    readonly props: object;
}

/** The model's state as a feature reads it: the core's, and its own slice. */
export type FeatureState<TTypes extends FeatureTypes = FeatureTypes> =
    DataGridState<unknown, unknown> & TTypes["state"];

/** What a key map entry takes. */
type PayloadIn<E> = E extends { readonly payload: infer P } ? P : never;
/** What a key map entry gives back. */
type ResultIn<E> = E extends { readonly result: infer R } ? R : never;

/** A feature's command handler: the state it leaves and the command's value, or why not. */
export type FeatureHandler<TState, P, R> = (
    state: TState,
    payload: P,
) => CommandResult<{ readonly state: TState; readonly value: R }>;

/** A header cell's share of a feature: the state fields and the attributes it adds. */
export interface FeaturePartContribution<TState> {
    /** fields of the part's state (`undefined` without the feature) */
    readonly state?: Partial<TState> | undefined;
    /** the element's attributes: `data-*` (through `dataAttributes`) and ARIA */
    readonly attributes?: PartAttributes | undefined;
}

/** A part's attributes: a name and its value (an absent one is `undefined`). */
export type PartAttributes = Readonly<
    Record<string, string | number | boolean | undefined>
>;

/** What an engine hands a feature's own handlers (`FeatureSpec.engine`), once. */
export interface FeatureEngineContext<TTypes extends FeatureTypes> {
    /** the grid's model, its keys typed by the feature's */
    readonly model: DataGridModel<
        unknown,
        unknown,
        readonly [DataGridFeature<TTypes>]
    >;
    /**
     * the header cell an event happened in, or `null`: not one of this grid's header cells, or a
     * control inside one (it acts on its own; a resizer is one)
     */
    readonly headerCellOf: (
        target: EventTarget | null,
    ) => HeaderCellLayout<unknown, unknown> | null;
    /** the engine's own means, for the keys, presses and drags a feature handles (Epic #144) */
    readonly engine: EngineKit;
}

/**
 * What an engine lends its features (Epic #144): its DOM questions, its scroll, its focus and its
 * drags, so a feature's keys and presses act as the engine's own would. Read at the time of the
 * event: nothing here is a snapshot.
 */
export interface EngineKit {
    /** the viewport attached, or `null` */
    readonly viewport: () => HTMLElement | null;
    /** the engine's options in effect */
    readonly options: () => DataGridEngineOptions;
    /** the direction in effect (the arrows mirror right to left) */
    readonly direction: () => GridDirection;
    /** this grid's cell an event happened in (a nested grid's cell is that grid's), or `null` */
    readonly cellOf: (target: EventTarget | null) => CellPosition | null;
    /** whether an element is one of this grid's cells (or header cells) itself */
    readonly isCellElement: (element: Element) => boolean;
    /** the body cell an element is itself (not a control inside it), or `null` */
    readonly bodyCellOf: (element: Element) => CellPosition | null;
    /**
     * the body cell a press happened in, not on a control inside it, a resizer or a handle, or
     * `null`
     */
    readonly pressedBodyCellOf: (
        target: EventTarget | null,
    ) => CellPosition | null;
    /** this grid's element of a cell, or `null` */
    readonly cellElement: (position: CellPosition) => HTMLElement | null;
    /** whether an event comes from this grid itself, not from a grid nested in one of its cells */
    readonly inViewport: (target: EventTarget | null) => boolean;
    /** this grid's element marked with `attribute` an event happened in, and the mark's value */
    readonly markedOf: (
        target: EventTarget | null,
        attribute: string,
    ) => { readonly element: HTMLElement; readonly value: string } | null;
    /** whether a position is the cell `b` (a header cell spanning rows is one on each of them) */
    readonly same: (a: CellPosition | null, b: CellPosition) => boolean;
    /** whether the keys at a body cell may still be the ones taken there (`sameKnownKeys`) */
    readonly keptAt: (
        position: CellPosition,
        keys: CellKeys | undefined,
    ) => boolean;
    /** a page of rows for the keys: the rows in view less one, at least one */
    readonly pageSize: () => number;
    /** the columns in view */
    readonly visibleColumns: () => Range;
    /**
     * makes the first cell in view active, to focus it (where focus lands when the grid itself
     * takes it); refused, or none, nothing is focused
     */
    readonly focusFirstVisibleCell: () => void;
    /** scrolls a cell into view (a body row's, a column's), as the keys do */
    readonly scrollToCell: (position: CellPosition) => void;
    /**
     * runs `move` with focus following the active cell: the cell it leaves active takes focus
     * once rendered (a move refused, or landing where it was: focus stays)
     */
    readonly followFocus: (move: () => void) => void;
    /**
     * makes a cell active, unless it is already (the navigation's `activate`; without it, no
     * cell is ever active): whether it is
     */
    readonly activate: (position: CellPosition) => boolean;
    /** moves the active cell a step (the navigation's `move`; without it, nothing) */
    readonly move: (direction: Direction) => void;
    /** gives the keys of a cell in interaction back to the grid, focus staying where it is */
    readonly leaveInteraction: () => void;
    /** tells the engine's listeners of an event (`fill`, `range-fill`, `range-paste`, …) */
    readonly emit: (event: string, value: unknown) => void;
    /** something a feature's view fields show changed (`FeatureEngine.view`): a new view */
    readonly refresh: () => void;
    /** takes a press as a drag (`FeatureDrag`), held by its element at once when it drags */
    readonly press: (event: PointerEvent, drag: FeatureDrag) => true;
    /** the drag's element holds the pointer from now on (a press past the slop) */
    readonly capture: (drag: FeatureDrag) => void;
    /** the drag's next frame, once (`false` without animation frames) */
    readonly askFrame: (drag: FeatureDrag) => boolean;
    /** the drag on now, if any (a feature's own, a resize's, …) */
    readonly drag: () => { readonly kind: string } | null;
    /** ends the drag on now, telling it how (its `end`) */
    readonly endDrag: (how: DragEnd) => void;
    /** stops following the drag on now, telling it nothing */
    readonly stopDrag: () => void;
    /**
     * a cell drag's frame: the edge scroll near the body's and the scrolling columns' edges
     * (another frame asked while it scrolls), then the body cell under the pointer (`known` when
     * it is that one), or `null` without rows or columns
     */
    readonly cellDragStep: (
        drag: FeatureDrag,
        known: CellPosition | null,
    ) => CellPosition | null;
    /** the body cell under a drag's pointer (`known` when it is that one), or `null` */
    readonly cellUnder: (
        drag: FeatureDrag,
        known: CellPosition | null,
    ) => CellPosition | null;
    /** the columns' axis on screen (Epic #148): each one's width and offset */
    readonly columnAxis: () => Axis;
    /** the view's width, in pixels (0 before the viewport is measured) */
    readonly viewportWidth: () => number;
    /** the columns pinned in effect, at the start and at the end, and their widths */
    readonly pinned: () => PinnedColumns;
    /** the virtual offset of the columns the view shows, right of the ones pinned at the start */
    readonly scrollLeft: () => number;
    /** where a pointer's x is in the view, from its inline start (a layout read; mirrored RTL) */
    readonly viewX: (clientX: number) => number;
    /**
     * the virtual column offset under a pointer at `x` in the view, kept over a part of it: a
     * pinned strip (`"start"`, `"end"`), or the columns that scroll (`undefined`)
     */
    readonly columnOffsetAt: (
        part: PinnedSide | undefined,
        x: number,
    ) => number;
    /** the edge scroll's step for a pointer at `x` over the columns that scroll (0 for none) */
    readonly columnEdgeStep: (x: number) => number;
    /**
     * scrolls the rows by `top` and the columns by `left` (0 for none), through the engine's own
     * scroll (scaled or not): whether they moved
     */
    readonly edgeScroll: (top: number, left: number) => boolean;
    /** the view on screen (the adapter's last commit), or `null` before one */
    readonly committed: () => GridView<unknown, unknown> | null;
    /**
     * the content widths of columns (by index in `view`, the view on screen), measured in one
     * layout: the widest of each one's rendered header cell, loaded body cells and summary cells
     */
    readonly measureColumns: (
        view: GridView<unknown, unknown>,
        columnIndexes: Iterable<number>,
    ) => ReadonlyMap<number, number>;
    /**
     * the engine's widths (automatic widths, flex shares) in effect, or (`overrides`) the ones
     * it would give the columns over those overrides
     */
    readonly autoWidths: (overrides?: ColumnWidths) => ColumnWidths;
}

/**
 * The columns pinned in effect (Epic #148, `columnPinning()`'s): how many lead at the start and
 * trail at the end, and how wide each strip is. None without pinning (every column scrolls).
 */
export interface PinnedColumns {
    readonly startCount: number;
    readonly startWidth: number;
    readonly endCount: number;
    readonly endWidth: number;
}

/**
 * How a feature lays the columns out (Epic #148): each sibling list in its order (`arrange`, the
 * same list when it changes nothing; `group`: the list's group, `undefined` at the top), and the
 * collapsible groups it collapses (`collapsed`: without one, every group shows its expanded
 * children).
 */
export type ColumnArrangement = ColumnArrangementOf<unknown, unknown>;

/**
 * A feature's handlers in an engine: each walked, in the features' order, at its place in the
 * engine's own handler, before what the engine does there itself; `true` takes the event.
 */
export interface FeatureEngine {
    /**
     * a key on an element a feature holds, after a drag's Escape and before the engine's other
     * guards (Epic #146: an edit's editor and its cell): `true` takes it, `false` ends the chain
     * without taking it (the element's own), `undefined` lets it through
     */
    readonly guardKeydown?:
        | ((event: KeyboardEvent, target: Element) => boolean | undefined)
        | undefined;
    /**
     * a key on a control of the cell in interaction, after the grid's Escape and Tab there
     * (Epic #148: a column resizer's arrows, Home, End and Enter)
     */
    readonly interactionKeydown?:
        | ((event: KeyboardEvent, target: Element) => boolean)
        | undefined;
    /**
     * a key on one of the grid's cells after the row groups' keys and before the interaction's
     * Enter and F2 (Epic #146: an edit's start); with Alt (a character typed with AltGr or
     * Option), the only hooks walked
     */
    readonly startKeydown?:
        | ((event: KeyboardEvent, target: Element) => boolean)
        | undefined;
    /**
     * a key on one of the grid's cells (not an edit's, not a control's in interaction, not a
     * field's): before the row groups', the edit's and the interaction's keys
     */
    readonly keydown?:
        | ((event: KeyboardEvent, target: Element) => boolean)
        | undefined;
    /**
     * a click in the grid that is not a drag's end, a group toggle's or an edit's double click
     * (a primary button, the press not moved past the click slop)
     */
    readonly click?: ((event: MouseEvent) => boolean) | undefined;
    /**
     * a key on one of the grid's own cells before any of the engine's guards, which it never
     * takes (the page's own copy and paste follow Ctrl/⌘+C and Ctrl/⌘+V)
     */
    readonly beforeKeydown?:
        | ((event: KeyboardEvent, target: Element) => void)
        | undefined;
    /**
     * a key on one of the grid's cells after the engine's own cell keys (the row groups', an
     * edit's start, the interaction's Enter and F2, a column's and a row's moves): the
     * selections' keys
     */
    readonly laterKeydown?:
        | ((event: KeyboardEvent, target: Element) => boolean)
        | undefined;
    /**
     * a key nothing else took, the last (after Escape gave focus up): the navigation's arrows,
     * Home, End and the page keys
     */
    readonly lastKeydown?:
        | ((event: KeyboardEvent, target: Element) => boolean)
        | undefined;
    /**
     * a primary press in the grid a resizer did not take, after the consumer's handlers and
     * before a row's handle and a header cell's drags: `true` takes it (`EngineKit.press` for a
     * drag). A body cell's press leaves a row's handle to it
     */
    readonly pointerdown?: ((event: PointerEvent) => boolean) | undefined;
    /**
     * a press's end (a release anywhere, or a pointer the browser took over), before a drag's
     * (Epic #146: focus left nowhere by an edit's commit goes back to the active cell)
     */
    readonly pointerEnd?: ((event: PointerEvent) => void) | undefined;
    /**
     * focus leaving an element of the grid, before the engine's own handling (Epic #146: an
     * edit commits when focus leaves it)
     */
    readonly focusout?: ((event: FocusEvent) => void) | undefined;
    /**
     * focus came to a cell (or inside it), the cell made active: `true` when that focus is the
     * feature's (Epic #146: the edited cell's editor), never an interaction
     */
    readonly focusin?: ((cell: CellPosition) => boolean) | undefined;
    /**
     * a view is on screen (the adapter's commit), focus moved: what follows the elements it
     * rendered (Epic #146: an edit's editor takes focus)
     */
    readonly rendered?:
        | ((view: GridView<unknown, unknown>) => void)
        | undefined;
    /** the root element's `copy` event, after the consumer's handlers: `true` takes it */
    readonly copy?: ((event: ClipboardEvent) => boolean) | undefined;
    /** the root element's `paste` event, after the consumer's handlers: `true` takes it */
    readonly paste?: ((event: ClipboardEvent) => boolean) | undefined;
    /**
     * after a committed change of the model, before the engine follows it: what the feature's
     * view fields show (`view`), so the view built for the change has them
     */
    readonly changed?:
        | ((
              before: DataGridState<unknown, unknown>,
              after: DataGridState<unknown, unknown>,
          ) => void)
        | undefined;
    /**
     * after a committed change of the model, the engine laid out for it: what ends with it (a
     * drag whose cells are gone)
     */
    readonly followed?:
        | ((
              before: DataGridState<unknown, unknown>,
              after: DataGridState<unknown, unknown>,
          ) => void)
        | undefined;
    /**
     * after a committed change of the model laid the columns out again (new columns, widths, an
     * order, a collapse: a new column axis or header), before the engine builds the view for it
     * (Epic #148: a column's drag follows its column, its view fields set, not refreshed)
     */
    readonly columnsFollowed?:
        | ((
              before: DataGridState<unknown, unknown>,
              after: DataGridState<unknown, unknown>,
          ) => void)
        | undefined;
    /**
     * whether a new layout of the same columns (`after.columns` new, `columnEntries` the same)
     * keeps the view on the column it showed first, by key (Epic #148: a collapse's)
     */
    readonly columnAnchored?:
        | ((
              before: DataGridState<unknown, unknown>,
              after: DataGridState<unknown, unknown>,
          ) => boolean)
        | undefined;
    /** the engine is destroyed: what its creation set up goes (a middleware) */
    readonly destroy?: (() => void) | undefined;
    /** the viewport attached: what it listens to from now on; returns what detaching undoes */
    readonly attach?: ((viewport: HTMLElement) => () => void) | undefined;
    /** the engine's options changed (`setOptions`) */
    readonly optionsChanged?:
        | ((options: DataGridEngineOptions) => void)
        | undefined;
    /**
     * the view's fields it holds itself (not the model's: a fill's drag), compared by identity:
     * one changing renders a new view (`EngineKit.refresh` asks for one)
     */
    readonly view?: (() => Readonly<Record<string, unknown>>) | undefined;
    /** its `engine.get` keys */
    readonly queries?: Readonly<Record<string, () => unknown>> | undefined;
    /** its `engine.run` actions (Epic #146: `edit-cell`, `commit-edit`, …) */
    readonly actions?:
        | Readonly<Record<string, (payload: never) => void>>
        | undefined;
    /**
     * the active cell made active (a click, a Tab, a control taking focus, an edit), the
     * navigation's: `false` when refused. Without a feature having it, no cell is ever active
     */
    readonly activate?: ((position: CellPosition) => boolean) | undefined;
    /** the active cell moved a step (an edit's Enter and Tab), the navigation's */
    readonly move?: ((direction: Direction) => void) | undefined;
}

/**
 * A controlled piece of a feature's root binding (`FeatureRoot.controlled`), typed by its value
 * here, held with the others in one list.
 */
export function defineControlled<TProps, TState, V>(
    spec: ControlledProp<TProps, TState, V>,
): ControlledProp<TProps, TState, unknown> {
    return spec as ControlledProp<TProps, TState, unknown>;
}

/** A feature's root props binding (`bindGridRoot`): its props, mapped onto its commands. */
export interface FeatureRoot<TTypes extends FeatureTypes> {
    /** its props' names: a root takes them, they never go on its element */
    readonly props: readonly (keyof TTypes["props"] & string)[];
    /** the model's options its props give when the root creates the model */
    readonly options?:
        | ((props: TTypes["props"]) => TTypes["options"])
        | undefined;
    /**
     * its controlled pieces (`bindControlled`, `adapter/controlled.ts`): each bound after the
     * core's, settled and started after them, in the features' order
     */
    readonly controlled?:
        | ((
              model: FeatureEngineContext<TTypes>["model"],
          ) => readonly ControlledProp<
              TTypes["props"],
              FeatureState<TTypes>,
              unknown
          >[])
        | undefined;
    /**
     * its plain props followed onto the model (a mode, a filter): each group run when one of its
     * inputs changed, after the core's data props
     */
    readonly follow?:
        | ((model: FeatureEngineContext<TTypes>["model"]) => readonly {
              readonly inputs: (props: TTypes["props"]) => readonly unknown[];
              readonly run: (props: TTypes["props"]) => void;
          }[])
        | undefined;
    /** the engine's options its props give (`fillable`), with the core's */
    readonly engineOptions?:
        | ((props: TTypes["props"]) => Partial<DataGridEngineOptions>)
        | undefined;
    /** what its props are told of the engine's events (`onFill`, `onCellEdit`), subscribed once */
    readonly events?:
        | ((
              engine: DataGridEngine<unknown, unknown>,
              props: () => TTypes["props"],
              model: FeatureEngineContext<TTypes>["model"],
          ) => void)
        | undefined;
}

/**
 * What a feature contributes, every part optional; `defineFeature` takes it. The core composes
 * each part once, when a grid is created (one function per contribution point: no allocation
 * per cell).
 */
export interface FeatureSpec<TTypes extends FeatureTypes> {
    /** its name: unique among a grid's features, what another one requires it by */
    readonly name: string;
    /** the features it needs, by name: one missing fails at creation, naming it */
    readonly requires?: readonly string[] | undefined;
    /** its slice of the state, from the model's options (the core's state already laid out) */
    readonly initial?:
        | ((
              state: DataGridState<unknown, unknown>,
              options: Partial<TTypes["options"]>,
          ) => TTypes["state"])
        | undefined;
    /** its commands: on the model's bus, through the same middleware, with the same results */
    readonly commands?:
        | {
              readonly [C in keyof TTypes["commands"]]: FeatureHandler<
                  FeatureState<TTypes>,
                  PayloadIn<TTypes["commands"][C]>,
                  ResultIn<TTypes["commands"][C]>
              >;
          }
        | undefined;
    /** its `get` keys */
    readonly queries?:
        | {
              readonly [K in keyof TTypes["queries"]]: (
                  state: FeatureState<TTypes>,
                  payload: PayloadIn<TTypes["queries"][K]>,
              ) => ResultIn<TTypes["queries"][K]>;
          }
        | undefined;
    /** its `is` keys */
    readonly questions?:
        | {
              readonly [K in keyof TTypes["questions"]]: (
                  state: FeatureState<TTypes>,
                  payload: TTypes["questions"][K],
              ) => boolean;
          }
        | undefined;
    /**
     * after a command replaced the core's source (`data.set`), columns (`columns.set`) or told
     * rows changed (`rows.changed`): its state kept to what still exists (the same object when
     * nothing changed)
     */
    readonly sourceChanged?:
        | ((
              after: FeatureState<TTypes>,
              before: FeatureState<TTypes>,
          ) => FeatureState<TTypes>)
        | undefined;
    /**
     * the keys of its state an engine's view carries, or of the fields its engine holds
     * (`FeatureEngine.view`), compared by identity (one changing renders a new view), for its
     * part contributions to read
     */
    readonly view?:
        | readonly ((keyof TTypes["state"] & string) | (string & {}))[]
        | undefined;
    /**
     * whether the rows are in an order of the app's that a row move would not keep (a sort):
     * then rows do not move
     */
    readonly rowsOrdered?:
        | ((state: FeatureState<TTypes>) => boolean)
        | undefined;
    /**
     * its say in the columns' layout (Epic #148: an order, a collapse): `arrangement` lays them
     * out by its state, and `changed` tells a state that lays them out otherwise (the columns are
     * laid out again then, the active cell following its column)
     */
    readonly columnLayout?:
        | {
              readonly changed: (
                  after: FeatureState<TTypes>,
                  before: FeatureState<TTypes>,
              ) => boolean;
              readonly arrangement: (
                  state: FeatureState<TTypes>,
              ) => ColumnArrangement;
          }
        | undefined;
    /**
     * the widths it gives columns over their declared sizing (Epic #148: a resize's), by column
     * key; the first feature having it gives them
     */
    readonly columnWidths?:
        | ((state: FeatureState<TTypes>) => ColumnWidths)
        | undefined;
    /**
     * the columns pinned in effect for the view's width (Epic #148: pinning's), from the columns
     * and their axis on screen; without it, none: every column scrolls
     */
    readonly pinnedColumns?:
        | ((
              columns: readonly Column<unknown, unknown>[],
              columnAxis: Axis,
              viewportWidth: number,
          ) => PinnedColumns)
        | undefined;
    /**
     * after every command (its handler, then `sourceChanged`): its state kept to the core's rules
     * (a range left when the active cell leaves its anchor); the same object when nothing changed
     */
    readonly stateChanged?:
        | ((
              after: FeatureState<TTypes>,
              before: FeatureState<TTypes>,
          ) => FeatureState<TTypes>)
        | undefined;
    /**
     * its cells are navigated by keys (Epic #144, APG grid): with it installed the grid has the
     * grid's roles (`grid`, `gridcell`), the active cell is its tab stop and the controls inside
     * cells are kept out of the tab order. Without any, a grid has the table's roles and no tab
     * stop of its own
     */
    readonly navigable?: boolean | undefined;
    /** what it adds to a body row's part: it fills `share`'s fields (nothing allocated per row) */
    readonly row?:
        | ((
              view: GridView<unknown, unknown> & TTypes["state"],
              rowIndex: number,
              meta: RowMeta | undefined,
              share: RowShare,
          ) => void)
        | undefined;
    /**
     * what it adds to a body cell's part (`span`: its columns): it fills `share`'s fields
     * (nothing allocated per cell)
     */
    readonly cell?:
        | ((
              view: GridView<unknown, unknown> & TTypes["state"],
              cell: CellPosition,
              span: number,
              share: CellShare,
          ) => void)
        | undefined;
    /** what it adds to the grid's element (`aria-multiselectable`) */
    readonly grid?:
        | ((
              view: GridView<unknown, unknown> & TTypes["state"],
          ) => PartAttributes | undefined)
        | undefined;
    /** what it adds to a header cell's part */
    readonly headerCell?:
        | ((
              view: GridView<unknown, unknown> & TTypes["state"],
              cell: HeaderCellLayout<unknown, unknown>,
          ) => FeaturePartContribution<HeaderCellState>)
        | undefined;
    /**
     * the editor props of a body cell while it is the one edited (what its column's
     * `renderEditCell` gets), from the engine's draft (`edit-draft`); `null` for any other cell
     * (Epic #146, editing's: the cell parts render a column's editor only with it)
     */
    readonly editCell?:
        | ((
              view: GridView<unknown, unknown>,
              cell: GridCellInfo<unknown, unknown>,
              draft: EditDraft | null | undefined,
              engine: DataGridEngine<unknown, unknown>,
          ) => EditCellRenderProps<unknown, unknown> | null)
        | undefined;
    /** its keys and presses in an engine, made once per engine */
    readonly engine?:
        | ((context: FeatureEngineContext<TTypes>) => FeatureEngine)
        | undefined;
    /** its root props, mapped onto its commands */
    readonly root?: FeatureRoot<TTypes> | undefined;
}

/**
 * A feature (Epic #141): what its factory returns (`sorting()`), installed on a grid through
 * `features` when it is created. Its types (`FeatureTypes`) type the grid's keys and props.
 */
export interface DataGridFeature<TTypes extends FeatureTypes = FeatureTypes>
    extends FeatureSpec<FeatureTypes> {
    /** its types only: never set */
    readonly "~types"?: TTypes | undefined;
}

/** Makes a feature from what it contributes (a factory returns it), typed by its `FeatureTypes`. */
export function defineFeature<TTypes extends FeatureTypes>(
    spec: FeatureSpec<TTypes>,
): DataGridFeature<TTypes> {
    // its parts typed by its own types: the core calls them with the grid's state, holding them
    return spec as unknown as DataGridFeature<TTypes>;
}

// ── typing the installed features ────────────────────────────────────────────

/** A list of installed features (a grid's `features`). */
export type DataGridFeatures = readonly DataGridFeature[];

type UnionToIntersection<U> = (
    U extends unknown
        ? (union: U) => void
        : never
) extends (intersection: infer I) => void
    ? I
    : never;

/** A feature's types, bound to a grid's row and node types. */
type BoundTypes<F, TRow, TNode> = F extends {
    readonly "~types"?: infer T;
}
    ? Exclude<T, undefined> & { readonly row: TRow; readonly node: TNode }
    : never;

/** One member of every installed feature's types, merged; `unknown` (nothing) with none. */
type Merged<
    TFeatures extends DataGridFeatures,
    K extends keyof FeatureTypes,
    TRow,
    TNode,
> = [TFeatures[number]] extends [never]
    ? unknown
    : UnionToIntersection<
          BoundTypes<TFeatures[number], TRow, TNode> extends infer T
              ? T extends FeatureTypes
                  ? T[K]
                  : never
              : never
      >;

/**
 * What a grid's installed features add, merged (Epic #141): their state, the model's options,
 * the commands, `get` and `is` keys, and a root's props. A grid's key maps are the core's and
 * these.
 */
export interface FeatureKeys<
    TFeatures extends DataGridFeatures,
    TRow = unknown,
    TNode = unknown,
> {
    readonly state: Merged<TFeatures, "state", TRow, TNode>;
    readonly options: Merged<TFeatures, "options", TRow, TNode>;
    readonly commands: Merged<TFeatures, "commands", TRow, TNode>;
    readonly queries: Merged<TFeatures, "queries", TRow, TNode>;
    readonly questions: Merged<TFeatures, "questions", TRow, TNode>;
    readonly props: Merged<TFeatures, "props", TRow, TNode>;
}

/** A feature's own types, as its factory declares them. */
type OwnTypes<F> = F extends { readonly "~types"?: infer T }
    ? Exclude<T, undefined>
    : never;

/**
 * Whether a list's features are not known (a list of `DataGridFeature`, as `DataGridFeatures`: a
 * grid of any features, what a model with features is assignable to). A list of known features,
 * a tuple or an array alike, is not.
 */
export type AnyFeatures<TFeatures extends DataGridFeatures> = [
    TFeatures[number],
] extends [never]
    ? false
    : FeatureTypes extends OwnTypes<TFeatures[number]>
      ? // a known feature whose members are all optional (props only: the clipboard's) is
        // assignable from `FeatureTypes` too: it still names keys of its own
        [KeysOf<OwnTypes<TFeatures[number]>>] extends [never]
          ? true
          : false
      : false;

/** The keys a feature's types name: none for a feature of unknown types (`FeatureTypes`). */
type KeysOf<T> = T extends FeatureTypes
    ?
          | keyof T["state"]
          | keyof T["options"]
          | keyof T["commands"]
          | keyof T["queries"]
          | keyof T["questions"]
          | keyof T["props"]
    : never;
