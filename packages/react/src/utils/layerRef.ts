import type { DataGridEngine, EngineLayer } from "@fragiola/data-grid";
import type * as React from "react";
import type { ReactNode } from "react";

type LayerRef = React.RefCallback<HTMLElement>;

/** Each engine's layer refs, made once: a part's ref keeps its identity across renders. */
const layerRefs = new WeakMap<object, Map<EngineLayer, LayerRef>>();

/** A ref that registers an element as one of the layers an engine writes. */
export function layerRef(
    engine: DataGridEngine<unknown, ReactNode>,
    layer: EngineLayer,
): LayerRef {
    let refs = layerRefs.get(engine);
    if (!refs) {
        refs = new Map();
        layerRefs.set(engine, refs);
    }
    let ref = refs.get(layer);
    if (!ref) {
        ref = (element) =>
            element ? engine.adapter.registerLayer(layer, element) : undefined;
        refs.set(layer, ref);
    }
    return ref;
}
