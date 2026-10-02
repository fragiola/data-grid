import type { Size } from "../axis/axis";
import type { Direction } from "../navigation/navigation";

// The grid's model: its data and its rules (D3). One generic is the row type; the second is what a
// column's renderers return (`unknown` in the core, `ReactNode` in the React adapter, which
// re-exports `Column<TRow>` with it fixed), so an app writes one generic.

/** What a header cell's renderer receives. */
export interface HeaderCellRenderProps<TRow, TNode = unknown> {
    readonly column: Column<TRow, TNode>;
    readonly columnIndex: number;
}

/** What a body cell's renderer receives: only for a loaded row. */
export interface CellRenderProps<TRow, TNode = unknown> {
    readonly row: TRow;
    readonly rowIndex: number;
    readonly column: Column<TRow, TNode>;
    readonly columnIndex: number;
    /** `column.getValue(row, rowIndex)`, or `row[column.key]` without one */
    readonly value: unknown;
}

/** A column of the grid (D10). */
export interface Column<TRow, TNode = unknown> {
    /** unique among the grid's columns */
    readonly key: string;
    /**
     * the header's text, as the app wrote it: what a header cell shows when it has no children
     * and the column no `renderHeaderCell` (the packages never translate or invent one)
     */
    readonly name?: string | undefined;
    /** in pixels */
    readonly width: number;
    /** the cell's value; without one, `row[key]` */
    readonly getValue?: ((row: TRow, rowIndex: number) => unknown) | undefined;
    /** what a header cell shows when it is given no children */
    readonly renderHeaderCell?:
        | ((props: HeaderCellRenderProps<TRow, TNode>) => TNode)
        | undefined;
    /** what a body cell of a loaded row shows when it is given no children */
    readonly renderCell?:
        | ((props: CellRenderProps<TRow, TNode>) => TNode)
        | undefined;
    /** anything the app wants to keep on the column */
    readonly meta?: Readonly<Record<string, unknown>> | undefined;
}

/** A cell: header cells are on row -1. */
export interface CellPosition {
    readonly rowIndex: number;
    readonly columnIndex: number;
}

/** A row's key: what identifies it across renders. */
export type RowKeyGetter<TRow> = (row: TRow, index: number) => string | number;

/**
 * Where the rows come from (D6): every row at once (fixed, or growing for infinite loading), or a
 * count and a getter answering `undefined` for a row not loaded yet. A row not loaded keeps its
 * place and its size.
 */
export type RowSource<TRow> =
    | { readonly rows: readonly TRow[] }
    | {
          readonly rowCount: number;
          readonly getRow: (index: number) => TRow | undefined;
      };

/** The model's state: immutable, replaced on every committed command. */
export interface DataGridState<TRow, TNode = unknown> {
    readonly columns: readonly Column<TRow, TNode>[];
    readonly source: RowSource<TRow>;
    readonly rowCount: number;
    readonly rowKey: RowKeyGetter<TRow> | undefined;
    readonly rowHeight: Size;
    /** 0 for a grid without a header row */
    readonly headerRowHeight: number;
    readonly activePosition: CellPosition | null;
}

/** What `createDataGridModel` starts from. */
export interface DataGridModelOptions<TRow, TNode = unknown> {
    columns?: readonly Column<TRow, TNode>[];
    rows?: readonly TRow[];
    rowCount?: number;
    getRow?: (index: number) => TRow | undefined;
    rowKey?: RowKeyGetter<TRow>;
    /** a row's height in pixels, or a function of its index (default 35) */
    rowHeight?: Size;
    /** the header row's height in pixels (default 35); 0 for no header row */
    headerRowHeight?: number;
    activePosition?: CellPosition | null;
}

/** `data.set`'s payload: the rows, or a count and a getter; and optionally how to key them. */
export type DataSetPayload<TRow> = (
    | { readonly rows: readonly TRow[] }
    | {
          readonly rowCount: number;
          readonly getRow: (index: number) => TRow | undefined;
      }
) & { readonly rowKey?: RowKeyGetter<TRow> | undefined };

/** Every command: its payload and the value it returns. */
export interface CommandMap<TRow, TNode = unknown> {
    /** replaces the columns (keys unique, widths finite and not negative) */
    "columns.set": {
        payload: { readonly columns: readonly Column<TRow, TNode>[] };
        result: { readonly columnCount: number };
    };
    /** replaces where the rows come from */
    "data.set": {
        payload: DataSetPayload<TRow>;
        result: { readonly rowCount: number };
    };
    /** changes the row height (a number or a function of the index) or the header row's */
    "sizes.set": {
        payload: {
            readonly rowHeight?: Size | undefined;
            readonly headerRowHeight?: number | undefined;
        };
        result: undefined;
    };
    /** makes a cell the active one (row -1 is the header) */
    "active-position.set": {
        payload: CellPosition;
        result: CellPosition;
    };
    /** leaves no cell active */
    "active-position.clear": {
        payload: Record<string, never>;
        result: undefined;
    };
    /** moves the active cell (the engine supplies `pageSize`, the rows in view) */
    "active-position.move": {
        payload: {
            readonly direction: Direction;
            readonly pageSize?: number | undefined;
        };
        result: CellPosition;
    };
}

export type CommandName = keyof CommandMap<unknown>;

export type PayloadOf<
    C extends CommandName,
    TRow = unknown,
    TNode = unknown,
> = CommandMap<TRow, TNode>[C]["payload"];

export type ResultOf<
    C extends CommandName,
    TRow = unknown,
    TNode = unknown,
> = CommandMap<TRow, TNode>[C]["result"];

/** Why a command did not apply. */
export type CommandErrorCode =
    /** no command has this name */
    | "unknown_command"
    /** the payload is not what the command takes */
    | "invalid_payload"
    /** the cell the payload names does not exist */
    | "not_found"
    /** a rule of the grid forbids it (nothing to move from, nothing to move to) */
    | "refused"
    /** a middleware vetoed it */
    | "vetoed"
    /** it was issued while another command ran, and will run after it */
    | "queued"
    /** a middleware threw */
    | "middleware_error";

export interface CommandError {
    readonly code: CommandErrorCode;
    readonly message: string;
}

/** What a command returns: its value, or why it did not apply. It never throws on bad input. */
export type CommandResult<R> =
    | { readonly ok: true; readonly value: R }
    | { readonly ok: false; readonly error: CommandError };

/** What a middleware sees of any command. */
export interface CommandContextBase<TRow, TNode = unknown> {
    /** `model.can`/`model.check`: nothing will be committed; do not cause side effects */
    readonly dryRun: boolean;
    /** the committed state the command applies to */
    readonly state: DataGridState<TRow, TNode>;
}

/**
 * What a middleware sees: a union discriminated by `command`, so checking the command narrows the
 * payload (`if (ctx.command === "active-position.move") ctx.payload.direction`).
 */
export type CommandContext<TRow, TNode = unknown> = {
    [C in CommandName]: CommandContextBase<TRow, TNode> & {
        readonly command: C;
        /** the payload; assign a new object to rewrite it before calling `next` */
        payload: PayloadOf<C, TRow, TNode>;
    };
}[CommandName];

/**
 * Runs around every command, engine-issued or not: veto (return an error without calling
 * `next`), rewrite (assign `ctx.payload`, then call `next`) or observe (call `next` and look at its
 * result). Returning `undefined` passes on `next`'s result when it was called, and vetoes when it
 * was not.
 */
export type Middleware<TRow, TNode = unknown> = (
    ctx: CommandContext<TRow, TNode>,
    next: () => CommandResult<unknown>,
) => CommandResult<unknown> | undefined;

/** What a listener receives: one event per committed command. */
export interface CommandEvent<TRow, TNode = unknown> {
    readonly command: CommandName;
    readonly payload: unknown;
    /** the command's value */
    readonly result: unknown;
    readonly before: DataGridState<TRow, TNode>;
    readonly after: DataGridState<TRow, TNode>;
}

export type CommandListener<TRow, TNode = unknown> = (
    event: CommandEvent<TRow, TNode>,
) => void;

/** What `model.get` reads: each key's payload (`undefined` for none) and result. */
export interface QueryMap<TRow, TNode = unknown> {
    /** the columns, in order */
    columns: { payload: undefined; result: readonly Column<TRow, TNode>[] };
    /** a column by its key */
    "column-by": {
        payload: { readonly key: string };
        result: Column<TRow, TNode> | undefined;
    };
    "column-count": { payload: undefined; result: number };
    "row-count": { payload: undefined; result: number };
    /** 1 with a header row, 0 without */
    "header-row-count": { payload: undefined; result: number };
    /** a row by its index; `undefined` while it is not loaded */
    "row-by": { payload: { readonly index: number }; result: TRow | undefined };
    /** a row's key: `rowKey(row, index)`, or its index when there is no getter or no row yet */
    "row-key-by": {
        payload: { readonly rowIndex: number };
        result: string | number;
    };
    /** a cell's value: `column.getValue`, or `row[column.key]`; `undefined` while not loaded */
    "cell-value-by": {
        payload: CellPosition;
        result: unknown;
    };
    "active-position": { payload: undefined; result: CellPosition | null };
    "row-height": { payload: undefined; result: Size };
    "header-row-height": { payload: undefined; result: number };
}

export type QueryKey = keyof QueryMap<unknown>;

/** What `model.is` answers. */
export interface QuestionMap {
    /** whether the cell is the active one */
    "cell-active": CellPosition;
    /** whether the row holds the active cell */
    "row-active": { readonly rowIndex: number };
    /** whether the row is loaded (its getter answered a row) */
    "row-loaded": { readonly rowIndex: number };
}

export type QuestionKey = keyof QuestionMap;

/** The arguments after a key: the payload, optional when the key takes none. */
export type PayloadArgs<P> = [P] extends [undefined]
    ? []
    : Record<string, never> extends P
      ? [payload?: P]
      : [payload: P];

type IsUnion<T, All = T> = T extends unknown
    ? [All] extends [T]
        ? false
        : true
    : never;

/**
 * A command's arguments after its name. With a name typed as a union of commands, the payload is
 * required: one of them may need it.
 */
export type CommandArgs<C extends CommandName, TRow, TNode> =
    true extends IsUnion<C>
        ? [payload: PayloadOf<C, TRow, TNode>]
        : PayloadArgs<PayloadOf<C, TRow, TNode>>;
