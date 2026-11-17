import type { ControlledProp } from "../adapter/controlled";
import type { HeaderCellState } from "../engine/parts";
import type { GridView } from "../engine/types";
import type { DataGridModel } from "../model/model";
import type {
    CommandResult,
    DataGridState,
    HeaderCellLayout,
} from "../model/types";

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
}

/**
 * A feature's handlers in an engine: each walked, in the features' order, at its place in the
 * engine's own handler, before what the engine does there itself; `true` takes the event.
 */
export interface FeatureEngine {
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
     * the keys of its state an engine's view carries (compared by identity: one changing
     * renders a new view), for its part contributions to read
     */
    readonly view?: readonly (keyof TTypes["state"] & string)[] | undefined;
    /**
     * whether the rows are in an order of the app's that a row move would not keep (a sort):
     * then rows do not move
     */
    readonly rowsOrdered?:
        | ((state: FeatureState<TTypes>) => boolean)
        | undefined;
    /** what it adds to a header cell's part */
    readonly headerCell?:
        | ((
              view: GridView<unknown, unknown> & TTypes["state"],
              cell: HeaderCellLayout<unknown, unknown>,
          ) => FeaturePartContribution<HeaderCellState>)
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
