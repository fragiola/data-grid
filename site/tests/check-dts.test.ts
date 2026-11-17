import { describe, expect, it } from "vitest";
import { anyUses, codeOnly } from "../../scripts/check-dts.ts";

// `pnpm build` runs scripts/check-dts.ts over the packages' emitted declarations.
describe("the built declarations check", () => {
    it("finds `any` in a type", () => {
        expect(anyUses("export declare function f(x: any): void;")).toEqual([
            "export declare function f(x: any): void;",
        ]);
        expect(anyUses("type A = Record<string, any>[];")).toHaveLength(1);
    });

    it("ignores `any` in comments, strings and longer words", () => {
        expect(
            anyUses(
                '/** any comment */\n// any\nexport type Company = "any";\ntype Anything = 1;',
            ),
        ).toEqual([]);
        expect(codeOnly('type A = "any"; // any')).not.toMatch(/\bany\b/);
    });

    it("ignores the Angular compiler's own metadata, not a member typed with `any`", () => {
        expect(
            anyUses(
                "    static ɵfac: i0.ɵɵFactoryDeclaration<DataGridRow<any>, never>;\n    static ɵdir: i0.ɵɵDirectiveDeclaration<DataGridRow<any>, never>;",
            ),
        ).toEqual([]);
        expect(anyUses("    readonly state: Signal<any>;")).toHaveLength(1);
    });
});
