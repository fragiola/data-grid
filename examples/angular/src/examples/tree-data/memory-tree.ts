import {
    Directive,
    inject,
    TemplateRef,
    ViewContainerRef,
} from "@angular/core";
import {
    injectLocalRows,
    type LocalRowsResult,
} from "@fragiola/data-grid-angular/local";
import { columns, getSubRows, rowKey } from "./columns";
import { type Entry, FILES } from "./files";

// The files in memory: one injection function makes the tree, searches it (a match's folders stay)
// and sorts it. A structural directive that renders nothing of its own: it holds the mode's state
// (from scratch each time the mode starts) and hands it to its template
// (`<ng-container *exampleMemoryTree="let local">`).

export interface MemoryTreeContext {
    $implicit: LocalRowsResult<Entry>;
}

@Directive({ selector: "ng-template[exampleMemoryTree]" })
export class MemoryTree {
    static ngTemplateContextGuard(
        _directive: MemoryTree,
        _context: unknown,
    ): _context is MemoryTreeContext {
        return true;
    }

    readonly local = injectLocalRows(FILES, columns, {
        getSubRows,
        rowKey,
        defaultExpandedGroupKeys: ["src"],
    });

    constructor() {
        inject(ViewContainerRef).createEmbeddedView(
            inject<TemplateRef<MemoryTreeContext>>(TemplateRef),
            { $implicit: this.local },
        );
    }
}
