"use client";

import { useDataGrid, useGridView } from "@fragiola/data-grid-react";
import { useSelectAll } from "@fragiola/data-grid-react/selection";
import { ArrowDown, ArrowUp } from "lucide-react";
import { createContext, type ReactNode, useContext } from "react";
import { Checkbox } from "#/components/ui/checkbox";
import * as styles from "./styles";

// The cells that read the grid's state: the selection is the grid's (the app keeps the keys it
// answers), the sort too. The columns stay the same objects: only these cells re-render.

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

/** The ids of the companies the grid holds: what the header's checkbox selects. */
export const CompanyIds = createContext<readonly number[]>([]);

/** A row's checkbox: the grid toggles it, a Shift+click selects the rows since the last one. */
export function SelectCell({
    rowIndex,
    name,
}: {
    rowIndex: number;
    name: string;
}) {
    const { model } = useDataGrid();
    // the view moves with the selection: the box follows
    useGridView();
    return (
        <Checkbox.Root
            aria-label={`Select ${name}`}
            checked={model.is("row-selected", { rowIndex })}
            onCheckedChange={(_, details) =>
                model.run("selected-rows.toggle", {
                    rowIndex,
                    extend:
                        "shiftKey" in details.event &&
                        details.event.shiftKey === true,
                })
            }
        >
            <Checkbox.Indicator />
        </Checkbox.Root>
    );
}

/** The header's checkbox over every company: every row, some (indeterminate) or none. */
export function SelectAllHeader() {
    const all = useSelectAll(useContext(CompanyIds));
    return (
        <Checkbox.Root
            aria-label="Select all"
            checked={all.status === "all"}
            indeterminate={all.status === "some"}
            onCheckedChange={all.toggle}
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
