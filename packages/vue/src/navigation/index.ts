// @fragiola/data-grid-vue/navigation: cell navigation (a feature since Epic #144), for an app
// that installs only this package. Vue has no navigation code of its own: this is the core's
// (`@fragiola/data-grid/navigation`). With it, the grid is a `grid` (or `treegrid`) of
// `gridcell`s with one tab stop, moved by the keys, and `Root` takes `activePosition` /
// `defaultActivePosition` / `onActivePositionChange`; without it, a `table` of `cell`s with no
// tab stop. An opt-in entry point: the primitives never import it.

export {
    type NavigationProps,
    type NavigationTypes,
    navigation,
    samePosition,
} from "@fragiola/data-grid/navigation";
