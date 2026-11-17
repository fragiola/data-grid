import type { ControlledProp } from "../adapter/controlled";
import type { HeaderCellState } from "../engine/parts";
import type { GridView } from "../engine/types";
import type { DataGridModel } from "../model/model";
import type { DataGridState, HeaderCellLayout } from "../model/types";
import type {
    DataGridFeature,
    FeatureEngine,
    FeatureEngineContext,
    FeatureHandler,
    FeaturePartContribution,
    FeatureState,
} from "./feature";

// The registry (Epic #141): a grid's features composed once, when its model is created. Each
// contribution point is one function (or one list) the core calls where it would have done the
// work itself; with no feature there, it is `undefined` and the core does nothing more.

/** A grid's features, composed: what the model, its engines and its root call. */
export interface GridFeatures {
    /** the features, as installed */
    readonly list: readonly DataGridFeature[];
    /** their commands' handlers, by name */
    readonly commands: ReadonlyMap<
        string,
        FeatureHandler<FeatureState, unknown, unknown>
    >;
    /** their `get` keys */
    readonly queries: ReadonlyMap<
        string,
        (state: FeatureState, payload: unknown) => unknown
    >;
    /** their `is` keys */
    readonly questions: ReadonlyMap<
        string,
        (state: FeatureState, payload: unknown) => boolean
    >;
    /** the state with every feature's slice, from the model's options */
    readonly initial: (
        state: DataGridState<unknown, unknown>,
        options: Readonly<Record<string, unknown>>,
    ) => DataGridState<unknown, unknown>;
    /** after the source, the columns or rows changed: each feature's state kept to them */
    readonly sourceChanged:
        | ((after: FeatureState, before: FeatureState) => FeatureState)
        | undefined;
    /** the state keys an engine's view carries for the features */
    readonly viewKeys: readonly string[];
    /** whether a feature keeps the rows in an order of the app's (a row move would not stay) */
    readonly rowsOrdered: (state: FeatureState) => boolean;
    /** what the features add to a header cell's part */
    readonly headerCell:
        | ((
              view: GridView<unknown, unknown>,
              cell: HeaderCellLayout<unknown, unknown>,
          ) => FeaturePartContribution<HeaderCellState>)
        | undefined;
    /** the root props the features add */
    readonly rootProps: readonly string[];
}

/** Every feature's own handlers in one engine: each list walked in the features' order. */
export interface GridFeatureEngine {
    readonly keydown: readonly NonNullable<FeatureEngine["keydown"]>[];
    readonly click: readonly NonNullable<FeatureEngine["click"]>[];
}

/** The composed features of each model (`featuresOf`): the model's surface stays its verbs. */
const COMPOSED = new WeakMap<object, GridFeatures>();

/** A grid without features: nothing composed, nothing called. */
const NONE = composeFeatures([]);

/** Composes a grid's features, once: it throws for two features of a name, or one missing a requirement. */
export function composeFeatures(
    features: readonly DataGridFeature[],
): GridFeatures {
    const names = new Set<string>();
    for (const feature of features) {
        if (names.has(feature.name)) {
            throw new TypeError(
                `feature "${feature.name}" is installed twice: install it once`,
            );
        }
        names.add(feature.name);
    }
    for (const feature of features) {
        for (const required of feature.requires ?? []) {
            if (!names.has(required)) {
                throw new TypeError(
                    `feature "${feature.name}" requires feature "${required}": install it too`,
                );
            }
        }
    }
    const commands = new Map<
        string,
        FeatureHandler<FeatureState, unknown, unknown>
    >();
    const queries = new Map<
        string,
        (state: FeatureState, payload: unknown) => unknown
    >();
    const questions = new Map<
        string,
        (state: FeatureState, payload: unknown) => boolean
    >();
    for (const feature of features) {
        collect(feature, "commands", feature.commands, commands);
        collect(feature, "queries", feature.queries, queries);
        collect(feature, "questions", feature.questions, questions);
    }
    const initials = features.flatMap((feature) =>
        feature.initial ? [feature.initial] : [],
    );
    const keepers = features.flatMap((feature) =>
        feature.sourceChanged ? [feature.sourceChanged] : [],
    );
    const ordering = features.flatMap((feature) =>
        feature.rowsOrdered ? [feature.rowsOrdered] : [],
    );
    const headerCells = features.flatMap((feature) =>
        feature.headerCell ? [feature.headerCell] : [],
    );
    return {
        list: features,
        commands,
        queries,
        questions,
        initial: (state, options) => {
            let next = state;
            for (const initial of initials) {
                next = { ...next, ...initial(state, options) };
            }
            return next;
        },
        sourceChanged:
            keepers.length > 0
                ? (after, before) =>
                      keepers.reduce(
                          (state, keep) => keep(state, before),
                          after,
                      )
                : undefined,
        viewKeys: features.flatMap((feature) => feature.view ?? []),
        rowsOrdered: (state) => ordering.some((ordered) => ordered(state)),
        headerCell:
            headerCells.length === 0
                ? undefined
                : headerCells.length === 1
                  ? headerCells[0]
                  : (view, cell) => mergedParts(headerCells, view, cell),
        rootProps: features.flatMap((feature) => feature.root?.props ?? []),
    };
}

/** A feature's keys of one kind into the grid's: a key two features (or one and the core) share throws. */
function collect<T>(
    feature: DataGridFeature,
    kind: string,
    entries: Readonly<Record<string, unknown>> | undefined,
    into: Map<string, T>,
): void {
    for (const [key, value] of Object.entries(entries ?? {})) {
        if (into.has(key)) {
            throw new TypeError(
                `feature "${feature.name}" adds ${kind} "${key}", which another feature adds`,
            );
        }
        into.set(key, value as T);
    }
}

/** Several features' shares of one part, merged in their order. */
function mergedParts<V, C>(
    parts: readonly ((
        view: V,
        cell: C,
    ) => FeaturePartContribution<HeaderCellState>)[],
    view: V,
    cell: C,
): FeaturePartContribution<HeaderCellState> {
    let state: Partial<HeaderCellState> = {};
    let attributes = {};
    for (const part of parts) {
        const share = part(view, cell);
        state = { ...state, ...share.state };
        attributes = { ...attributes, ...share.attributes };
    }
    return { state, attributes };
}

/** Holds a model's composed features, for its engines and root (`featuresOf`). */
export function registerFeatures(model: object, features: GridFeatures): void {
    COMPOSED.set(model, features);
}

/** A model's composed features: none for a model made without them. */
export function featuresOf(model: object): GridFeatures {
    return COMPOSED.get(model) ?? NONE;
}

/** Every feature's handlers in one engine, made once with what that engine hands them. */
export function featureEngine(
    features: GridFeatures,
    model: DataGridModel<unknown, unknown>,
    headerCellOf: FeatureEngineContext<never>["headerCellOf"],
): GridFeatureEngine {
    const context = {
        model,
        headerCellOf,
    } as unknown as FeatureEngineContext<never>;
    const engines = features.list.flatMap((feature) =>
        feature.engine ? [feature.engine(context)] : [],
    );
    return {
        keydown: engines.flatMap((engine) =>
            engine.keydown ? [engine.keydown] : [],
        ),
        click: engines.flatMap((engine) =>
            engine.click ? [engine.click] : [],
        ),
    };
}

/** Every feature's controlled root props, bound to a model (`bindGridRoot`). */
export function featureControlledProps<TProps>(
    features: GridFeatures,
    model: DataGridModel<unknown, unknown>,
): readonly ControlledProp<TProps, FeatureState, unknown>[] {
    return features.list.flatMap(
        (feature) =>
            (feature.root?.controlled?.(
                model as unknown as FeatureEngineContext<never>["model"],
            ) ?? []) as readonly ControlledProp<
                TProps,
                FeatureState,
                unknown
            >[],
    );
}

/** The model's options a root's props give for its features. */
export function featureOptions(
    features: readonly DataGridFeature[],
    props: object,
): Readonly<Record<string, unknown>> {
    let options = {};
    for (const feature of features) {
        const given = feature.root?.options?.(props);
        if (given) options = { ...options, ...given };
    }
    return options;
}
