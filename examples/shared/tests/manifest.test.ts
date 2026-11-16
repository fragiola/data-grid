import { afterEach, describe, expect, it } from "vitest";
import { examplesApp } from "../scripts/examples-lib.ts";
import { buildManifest } from "../scripts/manifest.ts";
import { fakeApp } from "./fake-app.ts";

// The manifest builder serves every framework: the files of each example in its own app, the core
// and its framework's adapter package. The React manifest's equality with main's is checked by
// diffing the site export (the PR of the Epic that moved it here, #120).

describe("the manifest", () => {
    let remove = () => {};
    afterEach(() => remove());

    it("lists a framework's example files, entry first, the core and its adapter package", async () => {
        const fake = fakeApp("vue", {
            "hello-grid/index.vue": [
                '<script setup lang="ts">',
                'import { DataGrid } from "@fragiola/data-grid-vue";',
                'import { X } from "@lucide/vue";',
                'import { styles } from "./styles";',
                'import { tasks } from "../_kit/tasks";',
                "</script>",
                "",
            ].join("\n"),
            "hello-grid/styles.ts": "export const styles = {};\n",
            "_kit/tasks.ts": "export const tasks = [];\n",
        });
        remove = fake.remove;
        const manifest = await buildManifest(fake.app);
        expect(manifest.examples).toHaveLength(1);
        const [example] = manifest.examples;
        expect(example).toMatchObject({
            id: "hello-grid",
            level: "getting-started",
            layout: "fill",
            files: [
                "hello-grid/index.vue",
                "_kit/tasks.ts",
                "hello-grid/styles.ts",
            ],
            packages: [
                "@fragiola/data-grid",
                "@fragiola/data-grid-vue",
                "@lucide/vue",
            ],
        });
        expect(manifest.files["hello-grid/index.vue"]?.lang).toBe("vue");
    });

    it("lists the core and the React package for every React example", async () => {
        const manifest = await buildManifest(examplesApp("react"));
        expect(manifest.examples.length).toBeGreaterThan(0);
        for (const example of manifest.examples) {
            expect(example.packages.slice(0, 2), example.id).toEqual([
                "@fragiola/data-grid",
                "@fragiola/data-grid-react",
            ]);
            expect(example.files[0], example.id).toBe(
                `${example.id}/index.tsx`,
            );
        }
    });
});
