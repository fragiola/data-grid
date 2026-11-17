import {
    bindGridRoot,
    type DataGridFeatures,
    GRID_ROOT_PROPS,
    type GridRootProps,
    rootPropsOf,
} from "@fragiola/data-grid";
import {
    onMounted,
    onScopeDispose,
    onUpdated,
    provide,
    queuePostFlushCb,
    shallowRef,
    type VNodeChild,
    watch,
} from "vue";
import { attachGridRef } from "../composables/use-data-grid-ref";
import {
    type DataGridContextValue,
    type DataGridRef,
    type GridContext,
    GridKey,
    HeaderRowKey,
    RowKey,
    SummaryKey,
    SummaryRowKey,
    TableKey,
} from "../context";
import {
    type DataGridComponent,
    definePrimitive,
    type PrimitiveProps,
    type SlotFunction,
} from "../utils/primitive";
import { elementRef, type RenderSlot, renderElement } from "../utils/render";

/** The root's state: what its `render` slot receives. */
export type RootState = Record<string, never>;

/**
 * The root's props: the core's root props (the data, the sizes, every piece of state controlled
 * or not, what it tells, the engine's options, the `features` it installs and their props:
 * `GridRootProps`), with column renderers returning vnodes, `as` and a `gridRef`. A handler is a
 * prop (`:on-active-position-change`, or `@active-position-change`). A feature's props
 * (`sort-columns`, `@sort-columns-change` with `sorting()`) are typed only with it installed
 * (`typedDataGrid<TRow, typeof features>()`).
 */
export type RootProps<
    TRow = unknown,
    TFeatures extends DataGridFeatures = DataGridFeatures,
> = PrimitiveProps &
    GridRootProps<TRow, VNodeChild, TFeatures> & {
        /**
         * a handle on this grid from outside the root (`useDataGridRef()`): its model and engine,
         * and the composables that take it. A template ref stays the root's component.
         */
        gridRef?: DataGridRef<TRow> | undefined;
    };

export interface RootSlots extends RenderSlot<RootState> {
    /** the grid: a `DataGrid.Grid` holding the header, the body, … */
    default?: SlotFunction<Record<never, never>>;
}

/** A feature prop's name as a root may receive it: as declared, and in kebab-case. */
function spellings(name: string): readonly [string, string] {
    return [name, name.replace(/\B([A-Z])/g, "-$1").toLowerCase()];
}

/**
 * The props the core reads: the root's declared props, and its features' props, which Vue hands
 * as fallthrough attributes (a component declares its props once, the features are the app's).
 * Without a feature prop, the props themselves; else one object for the root's life, each key a
 * getter of the latest value (the core reads them, and calls the handlers, when it needs them).
 */
function gridPropsOf(
    props: Record<string, unknown>,
    attrs: Record<string, unknown>,
    featureProps: readonly (readonly [string, string])[],
): Record<string, unknown> {
    if (featureProps.length === 0) return props;
    const gridProps: PropertyDescriptorMap = {};
    for (const key of GRID_ROOT_PROPS) {
        gridProps[key] = { enumerable: true, get: () => props[key] };
    }
    for (const [name, kebab] of featureProps) {
        gridProps[name] = {
            enumerable: true,
            get: () => (name in attrs ? attrs[name] : attrs[kebab]),
        };
    }
    return Object.defineProperties({}, gridProps);
}

/** The fallthrough attributes without the features' props: what goes on the element. */
function elementAttrs(
    attrs: Record<string, unknown>,
    dropped: ReadonlySet<string>,
): Record<string, unknown> {
    if (dropped.size === 0) return attrs;
    const rest: Record<string, unknown> = {};
    for (const key in attrs) {
        if (!dropped.has(key)) rest[key] = attrs[key];
    }
    return rest;
}

/**
 * The grid's root: the scroll container (a `div`, overflow auto; give it a size). It holds the
 * model and the engine, installs its `features` (fixed when it is created: a later list is told
 * in the console, never taken), maps its props onto the model's commands (controlled or not: the
 * core's `bindGridRoot`, after every render), and runs the grid's keys, clicks and presses after
 * the consumer's own listeners, so `preventDefault` cancels one. A feature's props are
 * fallthrough attributes to Vue (`sort-columns` or `sortColumns`, `@sort-columns-change`): the
 * root takes them, they never reach its element.
 */
export const Root: DataGridComponent<RootProps, RootSlots> = definePrimitive<
    RootProps,
    RootSlots
>(
    "Root",
    [...GRID_ROOT_PROPS, "gridRef", "as"],
    (props, { attrs, slots }) => {
        // the features' props, by name: the features are fixed for the grid's life
        const featureProps = (props.features ?? []).flatMap(
            (feature): readonly (readonly [string, string])[] =>
                (feature.root?.props ?? []).map(spellings),
        );
        const dropped = new Set(featureProps.flat());
        const gridProps = gridPropsOf(
            props as unknown as Record<string, unknown>,
            attrs,
            featureProps,
        ) as unknown as GridRootProps<unknown, VNodeChild>;
        const root = bindGridRoot<unknown, VNodeChild>(
            // the props as they are when read: the handlers are read when called
            () => gridProps,
        );
        const { model, engine } = root;
        const view = shallowRef(engine.adapter.getView());
        onScopeDispose(
            engine.adapter.subscribe(() => {
                view.value = engine.adapter.getView();
            }),
        );
        const context: GridContext = { model, engine, view };
        provide(GridKey, context);
        // a grid nested in a cell of another one is not inside the outer one's rows
        provide(RowKey, null);
        provide(HeaderRowKey, null);
        provide(SummaryKey, null);
        provide(SummaryRowKey, null);
        provide(TableKey, false);
        // the components that follow the ref (useRowWindow(gridRef), …) are told
        watch(
            () => props.gridRef,
            (gridRef, _previous, onCleanup) => {
                if (gridRef) {
                    onCleanup(
                        attachGridRef(
                            gridRef,
                            context as DataGridContextValue<unknown>,
                        ),
                    );
                }
            },
            { immediate: true },
        );
        // after every render (the parts' own refs and mounts done, child first): the props
        // follow onto the model (each group only when one of its props changed), the
        // controlled pieces settle, and the engine takes its options
        onMounted(() => root.sync());
        onUpdated(() => root.sync());
        // a function ref runs while Vue patches, before the element is in the page: the engine
        // attaches once it is (after the render, before the mounted hooks' sync), so it reads
        // the page's direction and the grid it is nested in
        const ref = elementRef((element) => {
            if (element.isConnected) return engine.adapter.attach(element);
            let live = true;
            let detach: (() => void) | undefined;
            queuePostFlushCb(() => {
                if (live) detach = engine.adapter.attach(element);
            });
            return () => {
                live = false;
                detach?.();
            };
        });
        // the grid's keys, header clicks (sorting) and presses on a resizer (a drag) run after
        // the consumer's listeners, so preventDefault cancels them
        const after = {
            onKeydown: (event: KeyboardEvent) => engine.adapter.keydown(event),
            onClick: (event: MouseEvent) => engine.adapter.click(event),
            onPointerdown: (event: PointerEvent) =>
                engine.adapter.pointerdown(event),
            // the clipboard, cells selectable (Epic #88): after the consumer's copy and paste
            onCopy: (event: ClipboardEvent) => engine.adapter.copy(event),
            onPaste: (event: ClipboardEvent) => engine.adapter.paste(event),
        };
        return () =>
            renderElement({
                tag: "div",
                as: props.as,
                attrs: elementAttrs(attrs, dropped),
                render: slots.render,
                state: {},
                ref,
                after,
                props: rootPropsOf(view.value),
                children: () => slots.default?.({}),
            });
    },
    ["ownTabStop"],
);
