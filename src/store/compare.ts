import { create } from 'zustand';
import type { CompareState, CompareActions, FileData, DiffResult, DirectoryDiffItem, DiffOptions } from '@/types';

const MAX_HISTORY_SIZE = 50;

const defaultDiffOptions: DiffOptions = {
  ignoreWhitespace: false,
  ignoreCase: false,
  ignoreBlankLines: false,
  normalizeLineEndings: true, // Default to true for cross-platform compatibility
};

const initialState: CompareState = {
  leftFile: null,
  rightFile: null,
  diffResult: null,
  directoryDiff: null,
  syncScroll: true,
  editedContent: {
    left: '',
    right: '',
  },
  diffOptions: defaultDiffOptions,
  history: {
    past: [],
    future: [],
  },
};

export const useCompareStore = create<CompareState & CompareActions>((set, get) => ({
  ...initialState,

  setLeftFile: (file: FileData | null) =>
    set((state) => ({
      leftFile: file,
      editedContent: {
        ...state.editedContent,
        left: typeof file?.content === 'string' ? file.content : '',
      },
      // Clear history when new file is loaded
      history: { past: [], future: [] },
    })),

  setRightFile: (file: FileData | null) =>
    set((state) => ({
      rightFile: file,
      editedContent: {
        ...state.editedContent,
        right: typeof file?.content === 'string' ? file.content : '',
      },
      // Clear history when new file is loaded
      history: { past: [], future: [] },
    })),

  setDiffResult: (result: DiffResult | null) => set({ diffResult: result }),

  setDirectoryDiff: (diff: DirectoryDiffItem[] | null) => set({ directoryDiff: diff }),

  setSyncScroll: (sync: boolean) => set({ syncScroll: sync }),

  updateEditedContent: (side: 'left' | 'right', content: string) =>
    set((state) => {
      // Save current state to history before making changes
      const currentState = { ...state.editedContent };
      const past = [...state.history.past, currentState].slice(-MAX_HISTORY_SIZE);

      return {
        editedContent: {
          ...state.editedContent,
          [side]: content,
        },
        history: {
          past,
          future: [], // Clear future on new changes
        },
      };
    }),

  setDiffOptions: (options: Partial<DiffOptions>) =>
    set((state) => ({
      diffOptions: {
        ...state.diffOptions,
        ...options,
      },
    })),

  undo: () =>
    set((state) => {
      if (state.history.past.length === 0) return state;

      const previous = state.history.past[state.history.past.length - 1];
      const newPast = state.history.past.slice(0, -1);

      return {
        editedContent: previous,
        history: {
          past: newPast,
          future: [state.editedContent, ...state.history.future].slice(0, MAX_HISTORY_SIZE),
        },
      };
    }),

  redo: () =>
    set((state) => {
      if (state.history.future.length === 0) return state;

      const next = state.history.future[0];
      const newFuture = state.history.future.slice(1);

      return {
        editedContent: next,
        history: {
          past: [...state.history.past, state.editedContent].slice(-MAX_HISTORY_SIZE),
          future: newFuture,
        },
      };
    }),

  canUndo: () => get().history.past.length > 0,

  canRedo: () => get().history.future.length > 0,

  reset: () => set(initialState),
}));
