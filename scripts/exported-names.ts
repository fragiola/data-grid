// From Dockable (fragiola/dockable, scripts/exported-names.ts), same author and licence.
// The names a TypeScript module exports, read from its source with regular expressions (enough
// for this codebase's formatting, Biome): used by the test that keeps the Vue package from
// shadowing a core name and matches its names to the React package's.

const DECLARATION =
    /^export\s+(?:declare\s+)?(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:const|let|var|function\*?|class|interface|type|enum|namespace)\s+([A-Za-z_$][\w$]*)/gm;
const NAMESPACE = /^export\s+\*\s+as\s+([A-Za-z_$][\w$]*)\s+from\b/gm;
const LIST = /^export\s+(?:type\s+)?\{([^}]*)\}/gm;

/**
 * The names in a specifier list `a, type B, c as d`: before `as` (`a`, `B`, `c`: what an import
 * takes from the module) or after it (`a`, `B`, `d`: what an export list exports).
 */
export function specifierNames(
    list: string,
    side: "before-as" | "after-as",
): string[] {
    return list
        .split(",")
        .map((raw) => raw.trim().replace(/^type\s+/, ""))
        .filter((raw) => raw.length > 0)
        .map((raw) => {
            const [name = "", alias = name] = raw.split(/\s+as\s+/);
            return side === "before-as" ? name : alias;
        });
}

/**
 * Every name `source` exports: declarations (`export const/function/class/interface/type/enum`),
 * `export * as X`, and `export { … }` / `export type { … }` lists, with or without `from`.
 * `export * from` adds no name of its own and is left out.
 */
export function exportedNames(source: string): string[] {
    const names = [
        ...[...source.matchAll(DECLARATION)].map(([, name]) => name),
        ...[...source.matchAll(NAMESPACE)].map(([, name]) => name),
        ...[...source.matchAll(LIST)].flatMap(([, list = ""]) =>
            specifierNames(list, "after-as"),
        ),
    ];
    return [
        ...new Set(names.filter((name): name is string => name !== undefined)),
    ];
}
