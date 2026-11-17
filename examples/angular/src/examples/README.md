# Examples (Angular)

Every example of the gallery in Angular, under the same folder name (its id) as in
`examples/react/src/examples`, with the same behaviour and look under the five themes. This app
renders one alone at `index.html?id=<folder>`. What every framework's examples share (the metadata,
the themes, the embed's messages, the manifest builder, the loader generator and every e2e spec)
lives once in `examples/shared`; the categories, the anatomy and the rules of an example are the
React README's (`examples/react/src/examples/README.md`). This page says what is Angular's own.

```
examples/angular/src/examples/
  <slug>/index.ts      the example: a standalone OnPush component with an inline template,
                       exported by default
  <slug>/styles.ts     how it looks: one class string (or function) per part
  <slug>/*.ts          optional siblings, kebab-case: components and directives, injection helpers
                       (`inject-<name>.ts`, React's hooks), framework-free modules; shown in the
                       code panel
  _kit/                the demo content and app policy, copied whole from examples/react
examples/angular/src/
  components/          the Angular kit: Fragiola UI's pieces over Angular CDK (atoms/, families/, ui/)
  lib/cn.ts, styles/   `cn` and the theme, copied from examples/react
```

## Adding an example

1. Write the React example first (`examples/react/src/examples/<slug>/`), its metadata and its spec
   (`examples/shared`), then the Vue one. Angular is a complete framework (`COMPLETE_FRAMEWORKS` in
   `examples/shared/e2e/available.ts`): a React example without its Angular counterpart fails
   `tests/examples.test.ts` here, and its spec fails for Angular.
2. Create `src/examples/<slug>/index.ts` and `styles.ts`. `pnpm --filter examples-angular dev` serves
   the embed (`http://localhost:5182/?id=<slug>`); `pnpm site:dev` serves every framework's on one
   port. The dev server compiles the adapter with the app: restart it after changing
   `packages/angular`, and after adding an example folder (Tailwind reads the new files then).
3. `pnpm --filter examples-angular e2e` runs every shared spec against this app's embed (a
   production build: `pnpm build` first).

## An Angular example

- **`index.ts` renders `dataGridRoot`**, with the parts under it, as the React one does: the
  directives go on your own elements (`<div [dataGridCell]="cell">`, `<table dataGridGrid>`), the
  children functions are templates (`<ng-template [dataGridRows]="columns" let-row>`), and there is
  no default content: each cell writes `<ng-container *dataGridCellContent />`. Typing a template
  by the columns (`[dataGridRows]="columns"`) types its row.
- **React's components are siblings**: a component or directive, often on the part's own element
  (`<div [dataGridHeaderCell]="cell" exampleSortHeader>`, which injects `DataGridHeaderCell` for its
  state); its hooks are injection functions (`inject-<name>.ts`) or fields: `useState` is a
  `signal`, `useMemo` a `computed`, an effect an `effect` (with its cleanup) or `ngOnInit` and
  `DestroyRef`; React's `useId` is a module counter.
- **Column renderers return templates**: `templateContent(this.nameCell, props)`, the
  `ng-template` declared inside the root element and typed by `[dataGridTemplate]="contextOf<…>()"`.
  The template is read through a static query (`@ViewChild("nameCell", { static: true })`): a
  signal query is marked dirty by every view the grid creates, and collected again by each cell
  that renders.
- **The grid from outside its root** (a toolbar, a readout): `createDataGridRef()` given to the
  root's own `[gridRef]`; `injectDataGrid()`'s model and engine are read once the root's inputs are
  set (a listener, an effect, `ngOnInit`), never in a constructor.
- **Looks in `styles.ts`, bound**: `[class]="styles.cell"`, never a class string in a template
  (`tests/examples.test.ts`). An Angular part has no `class={(state) => …}`: a look that depends on
  state uses the part's `data-*` (`data-pinned:bg-palette-base`), or is a function of what a
  template hands (`styles.row(row)`) or of the part's state (`#cell="dataGridCell"`, then
  `styles.cell(cell.state())`: `undefined` on the first pass, so the function takes it). A class
  string both `styles.ts` export is the same (`tests/examples.test.ts`), so every framework looks the
  same; a host element that must add no box of its own wears an Angular-only `contents` class.
- **Copyable imports only**: `@angular/*`, `@fragiola/data-grid-angular` (and `/local` and the
  features' entries: `/sorting`, `/navigation`, `/row-selection`, `/range`, `/clipboard`, `/fill`),
  `@fragiola/data-grid/local`, `@lucide/angular`, the kit (`#/components/ui/*`,
  `#/components/atoms/*`, `#/lib/cn`) and relative files.
- **The features it uses, installed**: `[features]="features"` on the root (`[navigation()]` in
  every grid navigated by keys, plus `rowSelection()`, `cellRange()`, `clipboard()`,
  `fillHandle()`, `sorting()` where it uses them), and a feature's inputs and outputs on its
  directive, imported from its entry (`dataGridNavigation [(activePosition)]`,
  `dataGridRowSelection rowSelection="multiple"`, `dataGridCellRange cellSelection="range"`,
  `dataGridClipboard (rangePaste)`, `dataGridFill (fill)`, `dataGridSorting`). A part that reads a
  feature's keys types its injection by it:
  `injectDataGrid<Task, [DataGridFeature<RowSelectionTypes>]>()`.

## The kit

`src/components` is the Angular edition of the Fragiola UI pieces the React examples use: the same
Tailwind classes and palette roles, over Angular CDK (`cdkListbox` for the select, `cdkMenu` for the
context menu) and native elements, icons from `@lucide/angular`. The class families
(`families/*.ts`), `cn` and the theme are copies of examples/react's (`tests/vendored.test.ts`
compares them); `tests/kit.test.ts` checks each piece's roles, names, `data-*` state and classes.
Each piece is a directive on your own element (`<button kitCheckbox>`, `<button kitSwitch>`,
`<button kitClickable>`), or a trigger given its popup's template. What differs from Base UI is
said at the top of each file, mainly:

- Base UI's state attributes (`data-checked`, `data-open`, `data-selected`, …) are on the parts, so
  the classes are the React ones.
- `kitCheckbox` takes `checked`, `indeterminate` and `disabled`, and tells a change with
  `(checkedChange)` (`{ checked, event }`, as Base UI's `onCheckedChange(checked, details)`);
  `kitSwitch` takes `[(checked)]`; the select's trigger takes `[value]`/`(valueChange)`, `items`
  and `defaultOpen`.
- A popup (a select's list, a menu, a tooltip) is the root element of a template its trigger opens
  in the body of the trigger's document (`components/floating.ts`, from Dockable's Angular kit);
  the context menu's `(openChange)` is where the app refuses an opening (`close()`).
