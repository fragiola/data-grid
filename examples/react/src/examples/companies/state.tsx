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

export interface TableState {
    selected: ReadonlySet<number>;
    visibleIds: readonly number[];
    toggle: (id: number) => void;
    toggleAll: () => void;
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

/** A row's checkbox. */
export function SelectCell({ id, name }: { id: number; name: string }) {
    const { selected, toggle } = useTable();
    return (
        <Checkbox.Root
            aria-label={`Select ${name}`}
            checked={selected.has(id)}
            onCheckedChange={() => toggle(id)}
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/** The header's checkbox: every row, some (indeterminate) or none. */
export function SelectAllHeader() {
    const { selected, visibleIds, toggleAll } = useTable();
    const count = visibleIds.filter((id) => selected.has(id)).length;
    return (
        <Checkbox.Root
            aria-label="Select all"
            checked={count > 0 && count === visibleIds.length}
            indeterminate={count > 0 && count < visibleIds.length}
            onCheckedChange={toggleAll}
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/**
 * A sortable column's header: its icon, its name and, while it is sorted, the direction. The
 * grid sorts on a click, Enter or Space on the header cell; the arrow is the app's.
 */
export function SortLabel({
    columnKey,
    icon,
    children,
}: {
    columnKey: SortKey;
    icon: ReactNode;
    children: ReactNode;
}) {
    const { sortColumns } = useGridView();
    const sorted = sortColumns.find((entry) => entry.columnKey === columnKey);
    return (
        <span className={styles.headerLabel}>
            {icon}
            {children}
            {sorted &&
                (sorted.direction === "ascending" ? (
                    <ArrowUp aria-hidden className={styles.sortIcon} />
                ) : (
                    <ArrowDown aria-hidden className={styles.sortIcon} />
                ))}
        </span>
    );
}

/** A link out of a cell. */
export function CellLink({
    href,
    children,
}: {
    href: string;
    children: ReactNode;
}) {
    return (
        <a className={styles.link} href={href} target="_blank" rel="noreferrer">
            {children}
        </a>
    );
}
