// The frameworks an examples app can be written in. Each one is an app of its own,
// `examples/<framework>` (package `examples-<framework>`), built for `<base>/embed/<framework>/`;
// what they share (the metadata, the themes, the embed protocol, the manifest, the e2e specs) is
// this package. `site/project.json`'s `frameworks` says which ones the site export ships.

export const FRAMEWORKS = ["react", "vue", "angular"] as const;

export type Framework = (typeof FRAMEWORKS)[number];

/** The file an example's folder is found by, and the code panel opens first. */
export const ENTRY_FILES: Record<Framework, string> = {
    react: "index.tsx",
    vue: "index.vue",
    angular: "index.ts",
};

/** The core, which every example installs next to its adapter. */
export const CORE_PACKAGE = "@fragiola/data-grid";

/** The adapter package an example of that framework installs, next to the core. */
export const ADAPTER_PACKAGES: Record<Framework, string> = {
    react: "@fragiola/data-grid-react",
    vue: "@fragiola/data-grid-vue",
    angular: "@fragiola/data-grid-angular",
};

/**
 * The icon package an example imports itself (a consumer installs it): listed in the manifest's
 * `packages`, after the core and the adapter.
 */
export const ICON_PACKAGES: Record<Framework, string> = {
    react: "lucide-react",
    vue: "@lucide/vue",
    angular: "@lucide/angular",
};

export function isFramework(value: unknown): value is Framework {
    return FRAMEWORKS.includes(value as Framework);
}
