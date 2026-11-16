import {
    bindGridRoot,
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
 * or not, what it tells, the engine's options; `GridRootProps`), with column renderers returning
 * vnodes, `as` and a `gridRef`. A handler is a prop (`:on-active-position-change`, or
 * `@active-position-change`).
 */
export type RootProps<TRow = unknown> = PrimitiveProps &
    GridRootProps<TRow, VNodeChild> & {
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

/**
 * The grid's root: the scroll container (a `div`, overflow auto; give it a size). It holds the
 * model and the engine, maps its props onto the model's commands (controlled or not: the core's
 * `bindGridRoot`, after every render), and runs the grid's keys, clicks and presses after the
 * consumer's own listeners, so `preventDefault` cancels one.
 */
export const Root: DataGridComponent<RootProps, RootSlots> = definePrimitive<
    RootProps,
    RootSlots
>(
    "Root",
    [...GRID_ROOT_PROPS, "gridRef", "as"],
    (props, { attrs, slots }) => {
        const root = bindGridRoot<unknown, VNodeChild>(
            // the props as they are when read: the handlers are read when called
            () => props as GridRootProps<unknown, VNodeChild>,
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
                attrs,
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
