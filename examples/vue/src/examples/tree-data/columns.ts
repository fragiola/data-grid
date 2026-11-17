import type { Column } from "@fragiola/data-grid-vue";
import type { VNodeChild } from "vue";
import { type Entry, formatSize } from "./files";

export const columns: Column<Entry, VNodeChild>[] = [
    { key: "select", width: 44, pinned: "start" },
    { key: "name", name: "Name", width: 300, pinned: "start", sortable: true },
    {
        key: "size",
        name: "Size",
        width: 110,
        sortable: true,
        renderCell: ({ row }) => formatSize(row.size),
    },
    { key: "modified", name: "Modified", width: 130, sortable: true },
    {
        key: "kind",
        name: "Kind",
        width: 100,
        getValue: (entry) => (entry.kind === "folder" ? "Folder" : "File"),
    },
];

/** A folder's entries, in memory. */
export const getSubRows = (entry: Entry) => entry.children;

/** An entry's key: its path, unique at every depth. */
export const rowKey = (entry: Entry) => entry.id;
