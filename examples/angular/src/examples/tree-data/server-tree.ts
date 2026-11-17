import {
    Directive,
    inject,
    type Signal,
    TemplateRef,
    ViewContainerRef,
} from "@angular/core";
import { createFakeApi } from "../_kit/fake-api";
import { injectLazyTree, type LazyTree } from "./lazy";

// The same files listed by a server, folder by folder, as they are expanded. A structural
// directive that renders nothing of its own: it holds the mode's server and tree (from scratch
// each time the mode starts) and hands the tree to its template
// (`<ng-container *exampleServerTree="let tree">`).

export interface ServerTreeContext {
    $implicit: Signal<LazyTree>;
}

@Directive({ selector: "ng-template[exampleServerTree]" })
export class ServerTree {
    static ngTemplateContextGuard(
        _directive: ServerTree,
        _context: unknown,
    ): _context is ServerTreeContext {
        return true;
    }

    readonly tree = injectLazyTree(createFakeApi(600));

    constructor() {
        inject(ViewContainerRef).createEmbeddedView(
            inject<TemplateRef<ServerTreeContext>>(TemplateRef),
            { $implicit: this.tree },
        );
    }
}
