// A copy's or a paste's selection held in a cell (Epic #88, Epic #89: WebKit fires a copy only
// while something is selected, Firefox fires either at the page's selection): the clipboard
// feature's (Epic #144).

/**
 * The style of the node a copy or a paste selects (`holdSelection`, Epic #88): out of the
 * cell's layout, unseen, and selectable whatever the cell's `user-select`.
 */
const CLIPBOARD_NODE_STYLE: readonly (readonly [string, string])[] = [
    ["position", "absolute"],
    ["width", "1px"],
    ["height", "1px"],
    ["overflow", "hidden"],
    ["opacity", "0"],
    ["pointer-events", "none"],
    ["user-select", "text"],
    ["-webkit-user-select", "text"],
];

/** The page's selection held in a cell's own node (`holdSelection`), and its ranges before. */
export interface HeldSelection {
    readonly node: Element;
    readonly ranges: readonly ReturnType<Selection["getRangeAt"]>[];
}

/** Whether `selection` is text selected inside `cell` itself (its content, its editor). */
export function selectedIn(selection: Selection, cell: Element): boolean {
    return (
        !selection.isCollapsed &&
        cell.contains(selection.anchorNode) &&
        cell.contains(selection.focusNode)
    );
}

/**
 * Selects a node of the cell's own, hidden and selectable, in place of the page's selection
 * (collapsed, as the grid keeps it, or text selected elsewhere on the page, which would take a
 * copy or a paste): the clipboard's events then come to the cell (Epic #89). Returns what puts
 * the selection back (`releaseSelection`).
 */
export function holdSelection(
    cell: Element,
    selection: Selection,
): HeldSelection {
    const ranges = Array.from({ length: selection.rangeCount }, (_, index) =>
        selection.getRangeAt(index),
    );
    const node = cell.ownerDocument.createElement("span");
    node.textContent = "\u200b";
    node.setAttribute("aria-hidden", "true");
    for (const [property, value] of CLIPBOARD_NODE_STYLE) {
        node.style.setProperty(property, value);
    }
    cell.append(node);
    selection.selectAllChildren(node);
    return { node, ranges };
}

/** Puts the selection back as it was before `holdSelection`, and removes its node. */
export function releaseSelection({ node, ranges }: HeldSelection): void {
    const selection = node.ownerDocument.getSelection();
    selection?.removeAllRanges();
    for (const range of ranges) selection?.addRange(range);
    node.remove();
}
