import {
    bindGridRoot,
    type GridRootProps,
    type GridView,
    rootPropsOf,
    withoutRootProps,
} from "@fragiola/data-grid";
import type * as React from "react";
import {
    type ReactNode,
    useCallback,
    useLayoutEffect,
    useRef,
    useState,
    useSyncExternalStore,
} from "react";
import {
    DataGridContext,
    type DataGridContextValue,
    HeaderRowContext,
    RowContext,
    SummaryContext,
    SummaryRowContext,
    ViewContext,
} from "../context";
import { attachGridRef, type DataGridRef } from "../hooks/use-data-grid-ref";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

/** The root's state: what its `className`/`style` functions and `render` receive. */
export type RootState = Record<string, never>;

/**
 * The root's props: the core's root props (the data, the sizes, every piece of state controlled
 * or not, what it tells, the engine's options; `GridRootProps`), the element's, and a `gridRef`.
 */
export type RootProps<TRow> = DivPrimitiveProps<RootState> &
    GridRootProps<TRow, ReactNode> & {
        /**
         * a handle on this grid from outside the root (`useDataGridRef()`): its model and engine,
         * and the hooks that take it. `ref` stays the root's element.
         */
        gridRef?: DataGridRef<TRow> | undefined;
        children?: ReactNode;
    };

/**
 * The grid's root: the scroll container (a `div`, overflow auto; give it a size). It holds the
 * model and the engine, maps its props onto the model's commands (controlled or not: the core's
 * `bindGridRoot`), and runs the grid's keys, clicks and presses after the consumer's own handlers,
 * so `preventDefault` cancels one.
 */
export function Root<TRow>(props: RootProps<TRow>) {
    const { gridRef, children, ...elementProps } = props;
    // the element's props: the root's own (the core's) left out
    const rest = withoutRootProps(elementProps);
    const latest = useRef(props);
    latest.current = props;

    const [grid] = useState(() => {
        const root = bindGridRoot<TRow, ReactNode>(() => latest.current);
        const { model, engine } = root;
        const context: DataGridContextValue<TRow> = { model, engine };
        // the grid's keys, header clicks (sorting) and presses on a resizer (a drag) run after the
        // consumer's onKeyDown, onClick and onPointerDown, on the root or on its render element,
        // so preventDefault cancels them
        const after = {
            onKeyDown: (event: React.KeyboardEvent) =>
                engine.adapter.keydown(event.nativeEvent),
            onClick: (event: React.MouseEvent) =>
                engine.adapter.click(event.nativeEvent),
            onPointerDown: (event: React.PointerEvent) =>
                engine.adapter.pointerdown(event.nativeEvent),
            // the clipboard, cells selectable (Epic #88): after the consumer's onCopy and onPaste
            onCopy: (event: React.ClipboardEvent) =>
                engine.adapter.copy(event.nativeEvent),
            onPaste: (event: React.ClipboardEvent) =>
                engine.adapter.paste(event.nativeEvent),
        };
        return { root, context, after };
    });
    const { context } = grid;
    const { engine } = context;
    // before paint; the components that follow the ref (useRowWindow(gridRef), …) are told
    useLayoutEffect(
        () => (gridRef ? attachGridRef(gridRef, context) : undefined),
        [gridRef, context],
    );
    const view = useSyncExternalStore(
        engine.adapter.subscribe,
        engine.adapter.getView,
        engine.adapter.getView,
    );
    const [, rerender] = useState(0);
    useLayoutEffect(() => {
        // the viewport attaches after the parts' first layout effects (refs attach child first)
        // and its size makes a new view: render it before the first paint, not after
        if (engine.adapter.getView() !== view) rerender((count) => count + 1);
        // the props follow onto the model, before paint (each group only when one of its props
        // changed), the controlled pieces settle, and the engine takes its options
        grid.root.sync();
    });

    const ref = useCallback(
        (element: HTMLElement | null) =>
            element ? engine.adapter.attach(element) : undefined,
        [engine],
    );

    const element = useRenderElement("div", rest, {
        state: {},
        ref,
        after: grid.after,
        children,
        props: rootPropsOf(view),
    });

    return (
        <DataGridContext value={context as unknown as DataGridContextValue}>
            <ViewContext
                value={view as unknown as GridView<unknown, ReactNode>}
            >
                {/* a grid nested in a cell of another one is not inside the outer one's rows */}
                <RowContext value={null}>
                    <HeaderRowContext value={null}>
                        <SummaryContext value={null}>
                            <SummaryRowContext value={null}>
                                {element}
                            </SummaryRowContext>
                        </SummaryContext>
                    </HeaderRowContext>
                </RowContext>
            </ViewContext>
        </DataGridContext>
    );
}
