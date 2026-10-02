"use client";

import { useGridView } from "@fragiola/data-grid-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import { Checkbox } from "#/components/ui/checkbox";
import * as styles from "./styles";

// The app's own table state, shared through a context: the columns stay the same objects (the
// grid keeps its layout), and only the cells that read the state re-render when it changes.

export type SortKey = "name" | "domain" | "employees" | "arr" | "country";

const SORT_KEYS: readonly SortKey[] = [
    "name",
    "domain",
    "employees",
    "arr",
    "country",
];

/** Whether a value (a select's) is one of the sortable columns. */
export function isSortKey(value: unknown): value is SortKey {
    return SORT_KEYS.some((key) => key === value);
}

export interface Sort {
    key: SortKey;
    direction: "ascending" | "descending";
}

export interface TableState {
    selected: ReadonlySet<number>;
    visibleIds: readonly number[];
    toggle: (id: number) => void;
    toggleAll: () => void;
    sort: Sort;
    sortBy: (key: SortKey) => void;
}

const TableContext = createContext<TableState | null>(null);

export function TableProvider({
    value,
    children,
}: {
    value: TableState;
    children: ReactNode;
}) {
    return <TableContext value={value}>{children}</TableContext>;
}

function useTable(): TableState {
    const value = useContext(TableContext);
    if (!value) throw new Error("the table state is missing");
    return value;
}

/** Where a control sits: its cell (the header row is -1). */
export interface CellAt {
    rowIndex: number;
    columnIndex: number;
}

/**
 * A control inside a cell is a tab stop only while its cell is active: Tab leaves the grid in
 * one step, and the arrows reach the cell (then Space or Enter, or Tab into the control).
 */
export function useCellTabIndex({ rowIndex, columnIndex }: CellAt) {
    const { active } = useGridView();
    // explicit: an `undefined` would override a component's own default (Base UI's checkbox)
    return active?.rowIndex === rowIndex && active.columnIndex === columnIndex
        ? 0
        : -1;
}

/** A row's checkbox. */
export function SelectCell({
    id,
    name,
    at,
}: {
    id: number;
    name: string;
    at: CellAt;
}) {
    const { selected, toggle } = useTable();
    return (
        <Checkbox.Root
            tabIndex={useCellTabIndex(at)}
            aria-label={`Select ${name}`}
            checked={selected.has(id)}
            onCheckedChange={() => toggle(id)}
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/** The header's checkbox: every row, some (indeterminate) or none. */
export function SelectAllHeader({ at }: { at: CellAt }) {
    const { selected, visibleIds, toggleAll } = useTable();
    const count = visibleIds.filter((id) => selected.has(id)).length;
    return (
        <Checkbox.Root
            tabIndex={useCellTabIndex(at)}
            aria-label="Select all"
            checked={count > 0 && count === visibleIds.length}
            indeterminate={count > 0 && count < visibleIds.length}
            onCheckedChange={toggleAll}
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/** A sortable header: its icon and name, and a button that sorts by it. */
export function SortHeader({
    sortKey,
    icon,
    at,
    children,
}: {
    sortKey: SortKey;
    icon: ReactNode;
    at: CellAt;
    children: ReactNode;
}) {
    const { sort, sortBy } = useTable();
    const active = sort.key === sortKey;
    return (
        <button
            type="button"
            tabIndex={useCellTabIndex(at)}
            className={styles.sortButton}
            onClick={() => sortBy(sortKey)}
        >
            {icon}
            {children}
            {active &&
                (sort.direction === "ascending" ? (
                    <ArrowUp aria-hidden className={styles.sortIcon} />
                ) : (
                    <ArrowDown aria-hidden className={styles.sortIcon} />
                ))}
        </button>
    );
}

/** A link out of a cell. */
export function CellLink({
    href,
    at,
    children,
}: {
    href: string;
    at: CellAt;
    children: ReactNode;
}) {
    return (
        <a
            className={styles.link}
            href={href}
            target="_blank"
            rel="noreferrer"
            tabIndex={useCellTabIndex(at)}
        >
            {children}
        </a>
    );
}

/** `aria-sort` for a header cell. */
export function useAriaSort(
    key: string,
): "ascending" | "descending" | undefined {
    const { sort } = useTable();
    return sort.key === key ? sort.direction : undefined;
}
