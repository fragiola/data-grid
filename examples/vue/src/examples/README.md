# Examples (Vue)

Every example of the gallery in Vue, under the same folder name (its id) as in
`examples/react/src/examples`, with the same behaviour and look under the five themes. This app
renders one alone at `index.html?id=<folder>`. What every framework's examples share (the metadata,
the themes, the embed's messages, the manifest builder, the loader generator and every e2e spec)
lives once in `examples/shared`; the categories, the anatomy and the rules of an example are the
React README's (`examples/react/src/examples/README.md`). This page says what is Vue's own.

```
examples/vue/src/examples/
  <slug>/index.vue     the example (a single-file component, `<script setup lang="ts">`)
  <slug>/styles.ts     how it looks: one class string (or function) per part
  <slug>/*.vue, *.ts   optional siblings, kebab-case: components, composables (`use-<name>.ts`),
                       framework-free modules; shown in the code panel
  _kit/                the demo content and app policy, copied whole from examples/react
examples/vue/src/
  components/          the Vue kit: Fragiola UI's pieces over Reka UI (atoms/, families/, ui/)
  hooks/               what the kit's popups share (the document they open in)
  lib/cn.ts, styles/   `cn` and the theme, copied from examples/react
```

## Adding an example

1. Write the React example first (`examples/react/src/examples/<slug>/`), its metadata and its spec
   (`examples/shared`). Vue is a complete framework (`COMPLETE_FRAMEWORKS` in
   `examples/shared/e2e/available.ts`): a React example without its Vue counterpart fails
   `tests/examples.test.ts` here, and its spec fails for Vue.
2. Create `src/examples/<slug>/index.vue` and `styles.ts`. `pnpm --filter examples-vue dev` serves the
   embed (`http://localhost:5181/?id=<slug>`); `pnpm site:dev` serves every framework's on one port.
3. `pnpm --filter examples-vue e2e` runs every shared spec against this app's embed.

## A Vue example

- **`index.vue` renders `<DataGrid.Root>`**, with the parts under it, as the React one does. The
  parts are typed by the row: `const DataGrid = typedDataGrid<Task>()` (a template cannot pass a
  type argument); columns are `Column<Task, VNodeChild>`, their renderers return vnodes
  (`h(SelectRow, { rowIndex })`).
- **Features are installed**: a grid that sorts installs `sorting()` from
  `@fragiola/data-grid-vue/sorting` (`const features = [sorting()] as const`, `:features="features"`
  on the root) and types its parts by them (`typedDataGrid<Task, typeof features>()`); without it a
  sortable column never sorts. `useLocalRows(...).props` hands the root its sort: an example that
  binds them installs sorting too. The sort a view shows is `sortColumnsOf(view)`.
- **React's components are sibling SFCs**, its hooks composables or `setup` code: `useState` is a
  `ref`, `useMemo` a `computed`, an effect a `watch` or `onMounted`/`onBeforeUnmount`, a context a
  `provide`/`inject` key in a sibling `.ts`.
- **Children functions are scoped slots** (`v-slot="{ row }"`, `v-slot="{ cell }"`), `render` is the
  `#render="{ props, state, children }"` slot, `render={<table />}` is `as="table"`.
- **Looks in `styles.ts`, bound**: `:class="styles.cell"`, never a class string in a template
  (`tests/examples.test.ts`). A Vue part has no `class={(state) => …}`: a look that depends on
  state uses the part's `data-*` (`data-pinned:bg-palette-base`), or is a function of what a slot
  hands (`styles.row(row)` with the `row` of `DataGrid.Rows`, `styles.cell(state)` in the `render`
  slot). A class string both `styles.ts` export is the same (`tests/examples.test.ts`), so both
  frameworks look the same.
- **State the grid keeps** is read through `useDataGrid()` (`{ model, engine }`) and re-read when
  the view changes: `useGridView()` inside a `computed`.
- **Copyable imports only**: `vue`, `@fragiola/data-grid-vue` (and `/local`, `/selection`, `/sorting`),
  `@fragiola/data-grid/(local|selection|fill)`, `@lucide/vue`, the kit (`#/components/ui/*`,
  `#/components/atoms/*`, `#/lib/cn`) and relative files.

## The kit

`src/components` is the Vue edition of the Fragiola UI pieces the React examples use: the same
Tailwind classes and palette roles, over Reka UI instead of Base UI, icons from `@lucide/vue`.
The class families (`families/*.ts`), `cn` and the theme are copies of examples/react's
(`tests/vendored.test.ts` compares them); `tests/kit.test.ts` checks each piece's roles, names,
`data-*` state and classes. What differs from Base UI is said at the top of each file, mainly:

- Base UI's state attributes (`data-checked`, `data-open`, `data-selected`, …) are added on Reka
  UI's parts, so the classes are the React ones.
- `Checkbox.Root` takes `checked`, `indeterminate` and `disabled`, and tells a change with
  `@checked-change="(checked, { event }) => …"`, like Base UI's `onCheckedChange`; `Switch` and
  `Select` take `v-model`.
- A trigger takes `as-child` where the React kit uses `render`; a menu item's action is `@select`;
  `ContextMenu.Content`'s `@close-auto-focus` is where React passes `finalFocus`.
