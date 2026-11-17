import {
    afterRenderEffect,
    Directive,
    effect,
    forwardRef,
    signal,
    untracked,
} from "@angular/core";
import { type GridState, type GridView, gridPartOf } from "@fragiola/data-grid";
import { DATA_GRID_TABLE, injectGrid, type TableContext } from "../context";
import type { DataGridNode } from "../utils/content";
import { bindPart, injectHost } from "../utils/helpers";

/**
 * The grid (`role="grid"`; `treegrid` when its rows have kinds, Epic #87) and the sizer: as large
 * as the whole dataset, so the scrollbars represent it. On a `<table>`, the parts it holds take a
 * table's structure. It is the grid's tab stop while no cell is active. Put it directly inside
 * `[dataGridRoot]`: `<div dataGridGrid>`, or `<table dataGridGrid>`.
 */
@Directive({
    selector: "[dataGridGrid]",
    exportAs: "dataGridGrid",
    providers: [
        {
            provide: DATA_GRID_TABLE,
            useExisting: forwardRef(() => DataGridGrid),
        },
    ],
})
export class DataGridGrid implements TableContext {
    private readonly grid = injectGrid("[dataGridGrid]");
    private readonly host = injectHost();
    private readonly part = () => gridPartOf(this.grid.view());

    /** a `<table>`: what it holds takes a table's structure (`*dataGridEmpty`) */
    readonly table = this.host.tagName === "TABLE";

    /** the grid's state: its row and column counts */
    state(): GridState {
        return this.part().state;
    }

    constructor() {
        bindPart(
            () => this.grid.engine,
            this.host,
            () => ({ props: this.part().props, layer: "grid" }),
        );
        // the view rendered: the one the parts were refreshed with in this change detection,
        // not one the engine reported since (its attach, after the render)
        const rendered = signal<GridView<unknown, DataGridNode> | null>(null);
        effect(() => {
            const view = this.grid.view();
            untracked(() => rendered.set(view));
        });
        // that view is on screen: the engine writes the layers' offsets for it and moves focus
        let committed: unknown = null;
        afterRenderEffect({
            write: () => {
                const view = rendered();
                if (!view || view === committed) return;
                committed = view;
                untracked(() => this.grid.engine.adapter.commit(view));
            },
        });
    }
}
