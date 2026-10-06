import { hash } from "../_kit/data";

// A project's files, as the example's data: folders hold files and folders, a folder's size is
// its files'. Demo content, the same on every load.

export interface Entry {
    /** its path: unique in the tree, its row's key */
    readonly id: string;
    readonly name: string;
    readonly kind: "folder" | "file";
    /** in bytes; a folder's, every file's under it */
    readonly size: number;
    /** `YYYY-MM-DD` */
    readonly modified: string;
    /** how many entries a folder holds (what a lazy grid keeps room for before they load) */
    readonly count: number;
    /** a folder's entries, in memory; a server's listing leaves them out */
    readonly children?: readonly Entry[];
}

type Draft =
    | readonly [name: string, size: number]
    | readonly [name: string, Draft[]];

function entry(parent: string, [name, content]: Draft): Entry {
    const id = parent ? `${parent}/${name}` : name;
    const seed = id.length * 31 + name.charCodeAt(0);
    const modified = `2026-0${1 + hash(seed, 9)}-${String(1 + hash(seed + 1, 28)).padStart(2, "0")}`;
    if (typeof content === "number") {
        return { id, name, kind: "file", size: content, modified, count: 0 };
    }
    const children = content.map((child) => entry(id, child));
    return {
        id,
        name,
        kind: "folder",
        size: children.reduce((sum, child) => sum + child.size, 0),
        modified,
        count: children.length,
        children,
    };
}

/** A few hundred packages in `node_modules`: enough rows to scroll. */
const PACKAGES: Draft[] = Array.from({ length: 240 }, (_, index) => [
    `package-${String(index + 1).padStart(3, "0")}`,
    [
        ["index.js", 1_000 + hash(index, 40_000)],
        ["package.json", 400 + hash(index + 1, 900)],
        ["README.md", 800 + hash(index + 2, 6_000)],
    ],
]);

const DRAFT: Draft[] = [
    [
        "src",
        [
            [
                "components",
                [
                    ["button.tsx", 4_200],
                    ["grid.tsx", 18_300],
                    ["menu.tsx", 7_600],
                ],
            ],
            [
                "hooks",
                [
                    ["use-rows.ts", 3_100],
                    ["use-cells.ts", 2_900],
                ],
            ],
            ["index.ts", 600],
            ["main.tsx", 1_200],
        ],
    ],
    [
        "docs",
        [
            ["intro.md", 5_400],
            ["api.md", 22_100],
            [
                "guides",
                [
                    ["styling.md", 8_000],
                    ["keyboard.md", 6_100],
                ],
            ],
        ],
    ],
    [
        "public",
        [
            ["favicon.svg", 900],
            [
                "images",
                [
                    ["hero.png", 284_000],
                    ["logo.png", 12_000],
                ],
            ],
        ],
    ],
    ["node_modules", PACKAGES],
    ["package.json", 1_400],
    ["README.md", 3_200],
];

/** The project's top entries, every folder's entries under it. */
export const FILES: readonly Entry[] = DRAFT.map((draft) => entry("", draft));

/** Every entry by its path. */
const BY_ID = new Map<string, Entry>();
const index = (entries: readonly Entry[]) => {
    for (const item of entries) {
        BY_ID.set(item.id, item);
        if (item.children) index(item.children);
    }
};
index(FILES);

/** A folder's listing as a server answers it: its entries, without theirs (`count` says how many). */
export function listingOf(folderId: string | null): readonly Entry[] {
    const items =
        folderId === null ? FILES : (BY_ID.get(folderId)?.children ?? []);
    return items.map(({ children: _, ...item }) => item);
}

/** `1234` → `1.2 KB`. */
export function formatSize(bytes: number): string {
    if (bytes < 1_000) return `${bytes} B`;
    if (bytes < 1_000_000) return `${(bytes / 1_000).toFixed(1)} KB`;
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
}
