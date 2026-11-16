import { describe, expect, it } from "vitest";
import { loadersSource } from "../scripts/generate.ts";
import type { ExampleMeta } from "../src/meta-types.ts";

const meta: ExampleMeta = {
    title: "T",
    description: "D",
    category: "columns",
    order: 1,
    features: [],
    layout: "flow",
};
const entry = {
    slug: "column-resizing",
    meta,
    files: [],
    registry: [],
    packages: [],
};

// The loaders file is text for the framework app: each framework imports its entry its own way.
describe("the loader generator", () => {
    it("imports a React example by its folder (index.tsx)", () => {
        const source = loadersSource("react", [entry]);
        expect(source).toContain('import type { ComponentType } from "react";');
        expect(source).toContain('import("../examples/column-resizing")');
        expect(source).toContain('layout: "flow"');
    });

    it("imports a Vue example's index.vue", () => {
        const source = loadersSource("vue", [entry]);
        expect(source).toContain('import type { Component } from "vue";');
        expect(source).toContain(
            'import("../examples/column-resizing/index.vue")',
        );
    });

    it("imports an Angular example's index.ts", () => {
        const source = loadersSource("angular", [entry]);
        expect(source).toContain('from "@angular/core"');
        expect(source).toContain("Type<unknown>");
        expect(source).toContain('import("../examples/column-resizing/index")');
    });
});
