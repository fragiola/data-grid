import {
    FOCUSABLE,
    isAltCharacter,
    isComposing,
    isElement,
    isGridControl,
    ownerViewport,
    PAGE_KEYS,
} from "../engine/dom";
import { isHeldCell } from "../engine/parts";
import type { CellEdit, EditDraft, EngineActionMap } from "../engine/types";
import {
    type DataGridFeature,
    defineControlled,
    defineFeature,
} from "../feature/feature";
import { cellPosition } from "../model/bounds";
import { done, fail, invalid } from "../model/result";
import { cellKeysAt } from "../model/source";
import type { CellKeys, EditingCell } from "../model/types";
import { type Direction, sameCell } from "../navigation/navigation";
import { isIndex } from "../utils/utils";
import { EDITOR_ATTRIBUTE, editActions, editCellPropsOf } from "./edit";
import {
    editRefusal,
    hasEditable,
    isCellEditable,
    type State,
    sameEditingCell,
    withEditingRules,
} from "./editing";
import type { EditingProps, EditingTypes, EditingView } from "./types";

// Cell editing (Epic #88, E4.3; a feature since Epic #146, requiring navigation): Enter, F2, a
// printable key or a double click edit an editable cell (the active one); the engine keeps the
// draft, takes Enter, Tab and Escape from the editor (commit and move, cancel) and leaves it every
// other key; a press or focus outside the cell (and outside what the app marks as its editor's)
// commits; a commit is told when the value changed (`onCellEdit`), and the grid writes nothing.
// What an editor looks like is the app's (a column's `renderEditCell`).

/** The engines made so far: each one's edits are named apart from another's (`editorProps`). */
let engineCount = 0;

/** The editing feature's definition: every grid installing it shares it. */
const EDITING = defineFeature<EditingTypes>({
    name: "editing",
    // the edited cell is the active one: without navigation, none is
    requires: ["navigation"],
    // kept once the rows are given (`stateChanged`): the active cell, an editable one
    initial: (_state, options) => ({
        editingCell: options.editingCell ?? null,
        editingKeys: null,
    }),
    commands: {
        "editing-cell.set": (state, payload) => {
            if (
                !Number.isInteger(payload?.rowIndex) ||
                !Number.isInteger(payload?.columnIndex)
            ) {
                return invalid(
                    "rowIndex and columnIndex must be whole numbers",
                );
            }
            const { startKey } = payload;
            if (startKey !== undefined && typeof startKey !== "string") {
                return invalid("startKey must be a string");
            }
            // a position inside a span edits that cell (E1.2)
            const position = isIndex(payload.columnIndex, state.columns.length)
                ? cellPosition(state, payload)
                : payload;
            const refusal = editRefusal(state, position);
            if (refusal) return refusal;
            const active = state.activePosition;
            if (!active || !sameCell(active, position)) {
                return fail("refused", "only the active cell is edited");
            }
            const editing: EditingCell = {
                rowIndex: position.rowIndex,
                columnIndex: position.columnIndex,
                ...(startKey === undefined ? {} : { startKey }),
            };
            const next = sameEditingCell(editing, state.editingCell)
                ? state
                : {
                      ...state,
                      editingCell: editing,
                      editingKeys: cellKeysAt(state, position) ?? null,
                  };
            return done(next, next.editingCell ?? editing);
        },
        "editing-cell.clear": (state) =>
            done(
                state.editingCell
                    ? { ...state, editingCell: null, editingKeys: null }
                    : state,
                undefined,
            ),
    },
    queries: {
        "editing-cell": (state) => state.editingCell,
    },
    questions: {
        "cell-editable": (state, position) => isCellEditable(state, position),
    },
    // the edit follows the active cell's rule, whatever moved it, and its row's and column's keys
    stateChanged: withEditingRules,
    view: ["editingCell"],
    cell: (view, cell, _span, share) => {
        share.editing = isHeldCell(
            (view as unknown as EditingView).editingCell,
            cell,
        );
    },
    editCell: (view, cell, draft, engine) =>
        editCellPropsOf(view, cell, draft, editActions(engine)),
    engine: ({ model, engine }) => {
        const stateOf = () => model.state as unknown as State;
        /** the edit's draft: the engine's while a cell is edited (`edit-draft`), else `null` */
        let editDraft: EditDraft | null = null;
        /** the keys the draft was made for (the model's `editingKeys`): other ones, another draft */
        let draftFor: CellKeys | null = null;
        /** this engine's name among the page's grids, and its edits so far: an edit's editor's name */
        const engineName = `g${++engineCount}`;
        let editCount = 0;
        /** an edit whose cell took no focus at its commit: cancelled in the next task, unless an editor took it */
        let noEditorTimer: number | null = null;
        /**
         * an edit started: its editor takes focus at the commit that renders it (`focusEditor`),
         * while focus is in the grid, or (`edit-cell`, a toolbar's) wherever it is
         */
        let editorFocus: "grid" | "anywhere" | null = null;
        /** `edit-cell` is starting an edit: its editor takes focus wherever focus is */
        let editCellAsked = false;
        /** the document whose presses an edit listens to (`onEditPress`), while one is open */
        let editPressDoc: Document | null = null;
        /** a press committed an edit holding focus: focus left nowhere goes back to the active cell */
        let refocusAfterPress = false;
        /** whether the grid's columns edit at all, worked out once per columns */
        let editsFor: State["columns"] | null = null;
        let edits = false;

        /** Whether a column of the grid is editable: without one, no key or click asks anything. */
        function editsCells(): boolean {
            const { columns } = stateOf();
            if (editsFor !== columns) {
                editsFor = columns;
                edits = hasEditable(columns);
            }
            return edits;
        }

        /**
         * Whether an element belongs to the edit: inside the edited cell (the cell itself
         * included), or inside an element the app marks with this edit's `editorProps` (a
         * popover): another grid's editor, or an earlier edit's, is not this one's.
         */
        function partOfEdit(element: Element): boolean {
            const editing = stateOf().editingCell;
            const cell = editing && engine.cellElement(editing);
            const name = editDraft?.editorProps[EDITOR_ATTRIBUTE];
            return Boolean(
                cell?.contains(element) ||
                    (name &&
                        element.closest(`[${EDITOR_ATTRIBUTE}="${name}"]`)),
            );
        }

        /**
         * The edited cell's controls that may be its editor, its own (a nested grid's are that
         * grid's): the ones inside an element marked as an editor (`EDITOR_ATTRIBUTE`) first,
         * then the others but the grid's own (a group's toggle, a row's drag handle, a fill
         * handle, a resizer).
         */
        function editorControlsIn(cell: HTMLElement): HTMLElement[] {
            const viewport = engine.viewport();
            const controls = [
                ...cell.querySelectorAll<HTMLElement>(FOCUSABLE),
            ].filter(
                (control) =>
                    ownerViewport(control) === viewport &&
                    !isGridControl(control),
            );
            const marked = (control: HTMLElement) =>
                cell.contains(control.closest(`[${EDITOR_ATTRIBUTE}]`));
            return [
                ...controls.filter(marked),
                ...controls.filter((control) => !marked(control)),
            ];
        }

        /** Focuses the first editor control of the edited cell that takes focus; returns it, or `null`. */
        function focusEditorIn(cell: HTMLElement): HTMLElement | null {
            const doc = cell.ownerDocument;
            for (const control of editorControlsIn(cell)) {
                control.focus({ preventScroll: true });
                if (doc.activeElement === control) return control;
            }
            return null;
        }

        /**
         * Enter, F2 or a printable key on a body cell in navigation that can be edited (its column
         * editable for its row): one `editing-cell.set` (a printable key its `startKey`; Enter and
         * F2 once per press). A character typed with AltGr (Ctrl and Alt) or Option (Alt) starts
         * one too (`isAltCharacter`); not with ⌘, Ctrl alone or another Alt key, nor Shift+Space
         * (the row's selection), Shift+Enter or a key of a composition (an IME); a cell that
         * cannot be edited lets the key through (its controls, a move).
         */
        function editStartKey(event: KeyboardEvent, target: Element): boolean {
            const { key } = event;
            const alt = event.altKey;
            const printable =
                [...key].length === 1 && !(key === " " && event.shiftKey);
            if (
                event.metaKey ||
                (event.ctrlKey && !alt) ||
                (alt && !isAltCharacter(event)) ||
                isComposing(event) ||
                !(
                    printable ||
                    key === "F2" ||
                    (key === "Enter" && !event.shiftKey)
                ) ||
                !editsCells()
            ) {
                return false;
            }
            const position = engine.bodyCellOf(target);
            if (!position || !model.is("cell-editable", position)) return false;
            event.preventDefault();
            if (event.repeat && !printable) return true;
            model.run(
                "editing-cell.set",
                printable ? { ...position, startKey: key } : position,
            );
            return true;
        }

        /**
         * A key in an edit, from its editor or its cell: Enter commits and moves down (Shift:
         * up), Tab commits and moves to the next column (Shift: the previous one), Escape
         * cancels; the cell takes focus. After the consumer's handlers (an editor prevents one to
         * keep the edit open: a value it refuses, a newline). On the edited cell itself (its
         * editor without focus: a parent keeping the edit), any other key goes to its editor,
         * focused now, and the page keys never scroll the grid natively. Any other key is the
         * editor's.
         */
        function editKey(event: KeyboardEvent, target: Element): boolean {
            if (event.ctrlKey || event.metaKey) return false;
            const shift = event.shiftKey;
            const move: Direction | null =
                event.key === "Enter"
                    ? shift
                        ? "up"
                        : "down"
                    : event.key === "Tab"
                      ? shift
                          ? "left"
                          : "right"
                      : null;
            if (move) {
                event.preventDefault();
                commitEdit(move, true);
                return true;
            }
            if (event.key === "Escape") {
                event.preventDefault();
                endEdit(null, true);
                return true;
            }
            const editing = stateOf().editingCell;
            const cell = editing && engine.cellElement(editing);
            if (!cell || target !== cell) return false;
            const editor = focusEditorIn(cell);
            if (PAGE_KEYS.has(event.key) || (event.key === " " && !editor)) {
                event.preventDefault();
                return true;
            }
            return false;
        }

        /**
         * Commits the edit: its draft told as a `cell-edit` when it is not the value it started
         * from (the app writes it; told, it is the value it starts from now, so an edit a
         * controlled parent keeps open never tells it twice), then the edit ends (`endEdit`).
         */
        function commitEdit(
            move: Direction | null | undefined,
            focusCell: boolean,
        ) {
            const state = stateOf();
            const editing = state.editingCell;
            const draft = editDraft;
            if (!editing || !draft) return;
            const column = state.columns[editing.columnIndex];
            if (column && !Object.is(draft.value, draft.initialValue)) {
                editDraft = { ...draft, initialValue: draft.value };
                const edit: CellEdit = {
                    rowIndex: editing.rowIndex,
                    columnIndex: editing.columnIndex,
                    columnKey: column.key,
                    value: draft.value,
                };
                engine.emit("cell-edit", edit);
            }
            endEdit(move ?? null, focusCell);
        }

        /**
         * Ends the edit, the cell taking focus first (its editor's focus would fall to the page as
         * it goes): with `move`, the active cell moves (the navigation's, focus following), which
         * ends it by the model's rule; without one (or a move that stays: an edge, a parent
         * keeping the cell), `editing-cell.clear`. One change of the edit a gesture: a controlled
         * parent is asked once.
         */
        function endEdit(move: Direction | null, focusCell: boolean) {
            const editing = stateOf().editingCell;
            if (!editing) return;
            if (focusCell) {
                engine.cellElement(editing)?.focus({ preventScroll: true });
            }
            const clear = () => {
                if (stateOf().editingCell === editing) {
                    model.run("editing-cell.clear", {});
                }
            };
            if (!move) return clear();
            engine.followFocus(() => {
                engine.move(move);
                clear();
            });
        }

        /**
         * After a model change: an edit started (new keys) makes its draft (the cell's value) and
         * listens to the page's presses; one ended (committed, cancelled, the active cell moved,
         * its row or column gone from its place) drops it, telling nothing. An interaction ends
         * with it (a feature's drag too: its own `changed`). At creation (an edit given to start
         * with), nothing is told yet: no one listens.
         */
        function followEdit(created = false) {
            const state = stateOf();
            const keys = state.editingKeys;
            if (!state.editingCell || !keys) {
                if (!editDraft) return;
                editDraft = null;
                draftFor = null;
                editorFocus = null;
                stopPresses();
                engine.emit("edit-draft", null);
                return;
            }
            if (keys === draftFor) return;
            draftFor = keys;
            const value = model.get("cell-value-by", state.editingCell);
            editCount += 1;
            editDraft = {
                value,
                initialValue: value,
                editorProps: {
                    [EDITOR_ATTRIBUTE]: `${engineName}-${editCount}`,
                },
            };
            editorFocus = editCellAsked ? "anywhere" : "grid";
            if (created) return;
            engine.leaveInteraction();
            listenEditPresses();
            engine.emit("edit-draft", editDraft);
        }

        /** Listens to the page's presses while an edit is open and the viewport attached. */
        function listenEditPresses() {
            const viewport = engine.viewport();
            if (!viewport || editPressDoc || !stateOf().editingCell) return;
            editPressDoc = viewport.ownerDocument;
            editPressDoc.addEventListener("pointerdown", onEditPress, true);
        }

        /** Stops listening to the page's presses. */
        function stopPresses() {
            editPressDoc?.removeEventListener("pointerdown", onEditPress, true);
            editPressDoc = null;
        }

        /**
         * A press while editing: outside the edited cell and anything the app marks as its
         * editor's, it commits (before the press focuses or activates anything); the viewport
         * itself (its scrollbars) keeps the edit open. Focus in the edit then, a press focusing
         * nothing (a spot of the grid that takes no focus, the page's text, a touch scroll) gives
         * it back to the active cell once it ends (`pointerEnd`).
         */
        function onEditPress(event: PointerEvent) {
            const { target } = event;
            if (
                !stateOf().editingCell ||
                !isElement(target) ||
                target === engine.viewport() ||
                partOfEdit(target)
            ) {
                return;
            }
            const focused = target.ownerDocument.activeElement;
            const held = isElement(focused) && partOfEdit(focused);
            commitEdit(undefined, false);
            refocusAfterPress = held;
        }

        /** After a press that committed an edit: focus left nowhere goes back to the active cell. */
        function refocusAfterEdit() {
            const viewport = engine.viewport();
            if (!refocusAfterPress || !viewport) return;
            refocusAfterPress = false;
            const doc = viewport.ownerDocument;
            const focused = doc.activeElement;
            const active = stateOf().activePosition;
            if (
                active &&
                (!focused || focused === doc.body || focused === viewport)
            ) {
                engine.cellElement(active)?.focus({ preventScroll: true });
            }
        }

        /** Replaces the draft (`change-edit`, an editor's `onChange`). */
        function changeEdit(value: unknown) {
            if (!editDraft || Object.is(editDraft.value, value)) return;
            editDraft = { ...editDraft, value };
            engine.emit("edit-draft", editDraft);
        }

        /**
         * At the commit that renders an edit: its editor takes focus, the cell's first control
         * (while focus is in the grid; started by `edit-cell`, wherever it is), unless the editor
         * holds it already (its own `autoFocus`, its popover). A cell with no control to take it
         * may have an editor that takes focus later (a portalled control focused in an effect or
         * a frame): in the next task, the same edit still open and focus in neither its cell's
         * controls nor its editor's, it has none and is cancelled, so an `editable` column
         * without one traps no key.
         */
        function focusEditor(rendered: object) {
            const editing = stateOf().editingCell;
            const viewport = engine.viewport();
            if (
                !editorFocus ||
                !editing ||
                !viewport ||
                (rendered as Partial<EditingView>).editingCell !== editing
            ) {
                return;
            }
            const cell = engine.cellElement(editing);
            if (!cell) return;
            const anywhere = editorFocus === "anywhere";
            editorFocus = null;
            const doc = viewport.ownerDocument;
            const focused = doc.activeElement;
            const inGrid = inGridOrNowhere(focused, doc);
            if (editorHolds(focused, cell)) return;
            const focusedEditor =
                anywhere || inGrid
                    ? focusEditorIn(cell)
                    : editorControlsIn(cell)[0];
            if (!focusedEditor) cancelWithoutEditor(inGrid);
        }

        /** Whether focus is in the grid or nowhere (none, the page's body): the grid's to move. */
        function inGridOrNowhere(
            focused: Element | null,
            doc: Document,
        ): boolean {
            return (
                !focused ||
                focused === doc.body ||
                Boolean(engine.viewport()?.contains(focused))
            );
        }

        /** Whether focus is in the edit elsewhere than its cell (an editor's control, its popover). */
        function editorHolds(
            focused: Element | null,
            cell: Element | null,
        ): boolean {
            return (
                isElement(focused) && focused !== cell && partOfEdit(focused)
            );
        }

        /** `focusEditor`'s cancel of an edit with no editor, in the next task (`noEditorTimer`). */
        function cancelWithoutEditor(focusCell: boolean) {
            const win = engine.viewport()?.ownerDocument.defaultView;
            const keys = stateOf().editingKeys;
            if (!win) return endEdit(null, focusCell);
            if (noEditorTimer !== null) win.clearTimeout(noEditorTimer);
            noEditorTimer = win.setTimeout(() => {
                noEditorTimer = null;
                const state = stateOf();
                const editing = state.editingCell;
                if (!editing || state.editingKeys !== keys) return;
                const focused = win.document.activeElement;
                if (editorHolds(focused, engine.cellElement(editing))) return;
                // focus back on the cell only from the grid (nothing focused anywhere else since)
                endEdit(
                    null,
                    focusCell && inGridOrNowhere(focused, win.document),
                );
            }, 0);
        }

        // an edit given to start with: its draft
        followEdit(true);

        return {
            // in an edit, its editor has the keys: the grid takes Enter, Tab (each a commit and a
            // move) and Escape (a cancel) only, from the editor or its cell; nothing else in the
            // edited cell ever reaches the grid's navigation
            guardKeydown: (event, target) => {
                if (!stateOf().editingCell || !partOfEdit(target)) {
                    return undefined;
                }
                return (
                    !event.altKey &&
                    !isComposing(event) &&
                    editKey(event, target)
                );
            },
            // Enter, F2 or a printable key on a cell that can be edited edits it: before the
            // interaction's Enter and F2, which stay a cell's without an edit
            startKeydown: editStartKey,
            // a double click on a cell that can be edited (not on a control inside it) edits it;
            // its first click made it active
            click: (event) => {
                if (
                    event.detail !== 2 ||
                    event.shiftKey ||
                    event.ctrlKey ||
                    event.metaKey ||
                    stateOf().editingCell ||
                    !editsCells()
                ) {
                    return false;
                }
                const position = engine.pressedBodyCellOf(event.target);
                if (!position || !model.is("cell-editable", position)) {
                    return false;
                }
                engine.activate(position);
                model.run("editing-cell.set", position);
                return true;
            },
            // focus leaving an edit for somewhere outside its cell and anything the app marks as
            // its editor's (a popover): it commits, staying where it is; focus going nowhere (a
            // removed popover, the window) is a press's to tell (`onEditPress`)
            focusout: (event) => {
                const next = event.relatedTarget;
                if (
                    stateOf().editingCell &&
                    isElement(next) &&
                    !partOfEdit(next)
                ) {
                    commitEdit(undefined, false);
                }
            },
            // the edited cell's editor took focus: an edit, never an interaction
            focusin: (cell) => {
                const editing = stateOf().editingCell;
                return editing !== null && engine.same(editing, cell);
            },
            // a press that committed an edit holding focus: focus nowhere comes back
            pointerEnd: refocusAfterEdit,
            // an edit's editor, rendered now, takes focus
            rendered: focusEditor,
            // an edit started or ended: its draft follows
            changed: (before, after) => {
                if (
                    (after as State).editingCell !==
                    (before as State).editingCell
                ) {
                    followEdit();
                }
            },
            // an edit given to start with listens to the page's presses
            attach: (viewport) => {
                listenEditPresses();
                return () => {
                    stopPresses();
                    if (noEditorTimer !== null) {
                        viewport.ownerDocument.defaultView?.clearTimeout(
                            noEditorTimer,
                        );
                        noEditorTimer = null;
                    }
                };
            },
            queries: { "edit-draft": () => editDraft },
            actions: {
                "edit-cell": (position: EngineActionMap["edit-cell"]) => {
                    // refused (a cell that cannot be edited): nothing changes
                    if (!model.is("cell-editable", position)) return;
                    const editing = stateOf().editingCell;
                    if (isHeldCell(editing, position)) return;
                    // another edit open: committed first, told
                    if (editing) commitEdit(null, false);
                    editCellAsked = true;
                    try {
                        engine.activate(position);
                        model.run("editing-cell.set", position);
                    } finally {
                        editCellAsked = false;
                    }
                },
                "change-edit": ({ value }: EngineActionMap["change-edit"]) =>
                    changeEdit(value),
                "commit-edit": (payload: EngineActionMap["commit-edit"]) => {
                    if ("value" in payload) changeEdit(payload.value);
                    commitEdit(null, true);
                },
                "cancel-edit": () => endEdit(null, true),
            },
        };
    },
    root: {
        props: [
            "editingCell",
            "defaultEditingCell",
            "onEditingCellChange",
            "onCellEdit",
        ],
        options: (props) => ({
            editingCell:
                props.editingCell !== undefined
                    ? props.editingCell
                    : props.defaultEditingCell,
        }),
        controlled: (model) => [
            defineControlled<EditingProps<unknown>, State, EditingCell | null>({
                prefix: "editing-cell.",
                prop: (props) => props.editingCell,
                onChange: (props) => props.onEditingCellChange,
                start: (props) => props.defaultEditingCell,
                read: (state) => state.editingCell,
                same: sameEditingCell,
                fromCommand: (command, value) =>
                    command === "editing-cell.clear"
                        ? null
                        : (value as EditingCell),
                // an edit the grid cannot take (not the active cell, not editable) settles
                // told
                apply: (value) => {
                    if (value === null) {
                        model.run("editing-cell.clear", {});
                    } else model.run("editing-cell.set", value);
                },
            }),
        ],
        // an edit committed: told with its row, loaded while it is edited
        events: (engine, props, model) => {
            engine.subscribe("cell-edit", (edit) => {
                const row = model.get("row-by", { index: edit.rowIndex });
                if (row !== undefined) props().onCellEdit?.({ ...edit, row });
            });
        },
    },
});

/**
 * Cell editing (`@fragiola/data-grid/editing`): install it on a grid with navigation
 * (`features: [navigation(), editing()]`) for its `editable` columns' cells to be edited (Enter,
 * F2, typing, a double click), each column's `renderEditCell` the app's editor, a commit told
 * (`onCellEdit`). Without it, no edit ever starts.
 */
export function editing(): DataGridFeature<EditingTypes> {
    return EDITING;
}
