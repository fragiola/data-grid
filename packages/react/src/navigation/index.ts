// @fragiola/data-grid-react/navigation: cell navigation (a feature since Epic #144): the keys, the
// active cell and the roving tab stop, `role="grid"` and `gridcell`. React has no navigation code
// of its own: this is the core's (`@fragiola/data-grid/navigation`). An opt-in entry point: the
// primitives never import it; a grid without it is a table (`role="table"`, `cell`, no tab stop).

export {
    type NavigationProps,
    type NavigationTypes,
    navigation,
    samePosition,
} from "@fragiola/data-grid/navigation";
