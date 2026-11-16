import {
    type AxisWindow,
    type DataGridEngine,
    EMPTY_WINDOW,
    type EngineEventKey,
    type EngineLayer,
    type EngineQueryKey,
    type EngineQueryMap,
} from "@fragiola/data-grid";
import {
    type ComputedRef,
    type ShallowRef,
    shallowRef,
    type VNodeChild,
    watch,
} from "vue";
import { type DataGridRef, useGrid } from "../context";
import { type ElementRef, elementRef } from "../utils/render";

/**
 * What a part composable returns: its state, and the props for its element (`v-bind="props"`;
 * the structural style in `props.style`, ready for Vue: lengths in `px`).
 */
export interface PartComposableResult<S> {
    readonly state: ComputedRef<S>;
    readonly props: ComputedRef<Record<string, unknown>>;
}

/**
 * An engine's value it reports with an event of the same key (a window, the edit's draft): read
 * again when the event comes; `fallback` without an engine. Follows the engine `engine` reads (a
 * `gridRef`'s changes as roots take it).
 */
export function useEngineValue<TRow, K extends EngineEventKey & EngineQueryKey>(
    engine: () => DataGridEngine<TRow, VNodeChild> | undefined,
    key: K,
    fallback: EngineQueryMap[K],
): Readonly<ShallowRef<EngineQueryMap[K]>> {
    const value: ShallowRef<EngineQueryMap[K]> = shallowRef(
        fallback,
    ) as ShallowRef<EngineQueryMap[K]>;
    watch(
        engine,
        (current, _previous, onCleanup) => {
            value.value = current ? current.get(key) : fallback;
            if (!current) return;
            onCleanup(
                current.subscribe(key, () => {
                    value.value = current.get(key);
                }),
            );
        },
        { immediate: true, flush: "sync" },
    );
    return value;
}

/** The rows' or the columns' window of the `Root` around, or of a `gridRef`'s. */
export function useWindow<TRow>(
    event: "row-window" | "column-window",
    gridRef: DataGridRef<TRow> | undefined,
): Readonly<ShallowRef<AxisWindow>> {
    const grid = useGrid(
        gridRef,
        "a window composable must be used inside <DataGrid.Root>, or be given a gridRef",
    );
    return useEngineValue(() => grid.value?.engine, event, EMPTY_WINDOW);
}

/** A template ref that registers its element as one of the layers an engine writes. */
export function layerRef(
    engine: DataGridEngine<unknown, VNodeChild>,
    layer: EngineLayer,
): ElementRef {
    return elementRef((element) =>
        engine.adapter.registerLayer(layer, element),
    );
}
