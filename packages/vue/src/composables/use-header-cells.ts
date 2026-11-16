import {
    type ComputedRef,
    computed,
    inject,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import {
    type HeaderCellInfo,
    type HeaderRowInfo,
    HeaderRowKey,
    useGridView,
} from "../context";

/**
 * A header row: the given one, else the one rendering (inside `DataGrid.HeaderRows` or
 * `DataGrid.HeaderRow`), else the last (a grid without groups has only that one).
 */
export function useHeaderRowOf<TRow>(
    row?: MaybeRefOrGetter<HeaderRowInfo<TRow> | undefined>,
): ComputedRef<HeaderRowInfo<TRow> | undefined> {
    const view = useGridView<TRow>();
    const rendering = inject(HeaderRowKey, null);
    return computed(() => {
        const { headerRows } = view.value;
        // the header row that provides it was rendered for this grid's row type
        return (
            toValue(row) ??
            (rendering?.() as HeaderRowInfo<TRow> | undefined) ??
            headerRows[headerRows.length - 1]
        );
    });
}

/**
 * The header cells a render shows in a header row: the given one, else the one rendering (inside
 * `DataGrid.HeaderRow`), else the last (a grid without groups has only that one).
 */
export function useHeaderCells<TRow = unknown>(
    row?: MaybeRefOrGetter<HeaderRowInfo<TRow> | undefined>,
): ComputedRef<readonly HeaderCellInfo<TRow>[]> {
    const of = useHeaderRowOf(row);
    return computed(() => of.value?.cells ?? []);
}
