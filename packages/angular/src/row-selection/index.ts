// @fragiola/data-grid-angular/row-selection: row selection (Epic #57, R1–R9; a feature since Epic
// #144), for an app that installs only this package: the core's
// (`@fragiola/data-grid/row-selection`), the root's selection inputs (`[dataGridRowSelection]`)
// and the "select all" control's injection function. An opt-in entry point: the directives never
// import it, and an app that never installs row selection never ships it.

import {
    computed,
    DestroyRef,
    Directive,
    effect,
    inject,
    input,
    isSignal,
    output,
    type Signal,
    signal,
    untracked,
} from "@angular/core";
import type {
    DataGridFeature,
    DataGridModel,
    RowKey,
    RowSelectable,
    RowSelection,
} from "@fragiola/data-grid";
import {
    type RowSelectionProps,
    type RowSelectionTypes,
    type SelectAllState,
    selectAllState,
    selectAllToggled,
} from "@fragiola/data-grid/row-selection";
import {
    type DataGridContextValue,
    type DataGridNode,
    type DataGridRef,
    DataGridRoot,
    injectDataGrid,
} from "@fragiola/data-grid-angular";

export {
    type RowSelectionCommands,
    type RowSelectionOptions,
    type RowSelectionProps,
    type RowSelectionState,
    type RowSelectionTypes,
    rowSelection,
    type SelectAllState,
    type SelectionStatus,
    selectAllState,
    selectAllToggled,
    selectionStatus,
    toggledRowKeys,
    withoutRowKeys,
    withRowKeys,
} from "@fragiola/data-grid/row-selection";

/** The row selection feature, as a model's features list types it. */
type RowSelectionFeatures = readonly [DataGridFeature<RowSelectionTypes>];

/**
 * The root's row selection (React's `rowSelection`, `isRowSelectable`, `selectedRowKeys`,
 * `defaultSelectedRowKeys` and `onSelectedRowKeysChange` on `Root`, typed by `rowSelection()`): on
 * the root's element, with `rowSelection()` in its features (`<div dataGridRoot
 * [features]="features" dataGridRowSelection rowSelection="multiple"
 * [(selectedRowKeys)]="selected">`). Its inputs are the root's. Without `rowSelection()`
 * installed, the core reads none of them.
 */
@Directive({
    selector: "[dataGridRoot][dataGridRowSelection]",
    exportAs: "dataGridRowSelection",
})
export class DataGridRowSelection<TRow = unknown> {
    /**
     * how rows are selected: one at a time or many (default: not at all). Selected rows carry
     * `data-selected` and `aria-selected`; Shift+Space, Shift+Up/Down and Ctrl/⌘+A select
     */
    readonly rowSelection = input<RowSelection | undefined>(undefined);
    /** whether a loaded row can be selected (default: every row can) */
    readonly isRowSelectable = input<RowSelectable<TRow> | undefined>(
        undefined,
    );
    /**
     * the selected rows' keys, controlled; pair it with `selectedRowKeysChange`
     * (`[(selectedRowKeys)]`)
     */
    readonly selectedRowKeys = input<readonly RowKey[] | undefined>(undefined);
    /** the selected rows' keys to start with, uncontrolled */
    readonly defaultSelectedRowKeys = input<readonly RowKey[] | undefined>(
        undefined,
    );
    /** the selection changed (or, controlled, asks to): a row was toggled, or a command ran */
    readonly selectedRowKeysChange = output<readonly RowKey[]>();

    /** one handler for the directive's life: the root renders what the app did with it */
    private readonly changed = (rowKeys: readonly RowKey[]) =>
        this.selectedRowKeysChange.emit(rowKeys);

    constructor() {
        const root = inject(DataGridRoot);
        inject(DestroyRef).onDestroy(
            root.addPropsSource<RowSelectionFeatures>(
                (): RowSelectionProps<TRow> => ({
                    rowSelection: this.rowSelection(),
                    isRowSelectable: this.isRowSelectable(),
                    selectedRowKeys: this.selectedRowKeys(),
                    defaultSelectedRowKeys: this.defaultSelectedRowKeys(),
                    onSelectedRowKeysChange: this.changed,
                }),
                { inputs: true },
            ),
        );
    }
}

/** What `injectSelectAll` gives a "select all" control: each field read when used. */
export interface SelectAll extends SelectAllState {
    /**
     * selects every one of the rows, or clears them when every one is selected; with one row at
     * a time (single mode), it only clears
     */
    readonly toggle: () => void;
}

/**
 * A "select all" control's state over the rows the app names (`rowKeys`: the rows on screen, a
 * page, every filtered row; leave out the rows that cannot be selected), and its toggle, through
 * `selected-rows.set` (a controlled grid asks the parent; React's `useSelectAll`). While rows are
 * not selectable, nothing is selected and the toggle does nothing; without `rowSelection()`
 * installed, rows never are. Inside a root, or with a `gridRef` (nothing selected until a root
 * takes it). Call it in an injection context.
 */
export function injectSelectAll<TRow>(
    rowKeys:
        | readonly RowKey[]
        | Signal<readonly RowKey[]>
        | (() => readonly RowKey[]),
    gridRef?: DataGridRef<TRow>,
): SelectAll {
    const keys = () =>
        isSignal(rowKeys) || typeof rowKeys === "function"
            ? (rowKeys as () => readonly RowKey[])()
            : rowKeys;
    const grid: Signal<DataGridContextValue<TRow> | null> = gridRef
        ? injectDataGrid(gridRef)
        : signal(injectDataGrid<TRow>()).asReadonly();
    // the keys and the mode alone: a move or a sort changes nothing here
    const selected = signal<readonly RowKey[]>([]);
    const mode = signal<RowSelection | undefined>(undefined);
    // the feature's state and command: `undefined` and `not_found` without it installed
    const modelOf = (value: DataGridContextValue<TRow> | null | undefined) =>
        value?.model as
            | DataGridModel<TRow, DataGridNode, RowSelectionFeatures>
            | undefined;
    effect((onCleanup) => {
        const model = modelOf(grid());
        untracked(() => {
            const read = () => {
                selected.set(model?.state.selectedRowKeys ?? []);
                mode.set(model?.state.rowSelection);
            };
            read();
            if (model) onCleanup(model.subscribe(read));
        });
    });
    const state = computed(() => selectAllState(mode(), selected(), keys()));
    const toggle = () => {
        const model = modelOf(untracked(grid));
        if (!model) return;
        const next = selectAllToggled(
            model.state.rowSelection,
            model.state.selectedRowKeys,
            untracked(keys),
        );
        if (next) model.run("selected-rows.set", { rowKeys: next });
    };
    return {
        get status() {
            return state().status;
        },
        get count() {
            return state().count;
        },
        get canToggle() {
            return state().canToggle;
        },
        toggle,
    };
}
