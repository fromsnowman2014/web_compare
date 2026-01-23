import { create } from 'zustand';
import type { CompareState, CompareActions, FileData, DiffResult, DirectoryDiffItem } from '@/types';

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
    })),

  setRightFile: (file: FileData | null) =>
    set((state) => ({
      rightFile: file,
      editedContent: {
        ...state.editedContent,
        right: typeof file?.content === 'string' ? file.content : '',
      },
    })),

  setDiffResult: (result: DiffResult | null) => set({ diffResult: result }),

  setDirectoryDiff: (diff: DirectoryDiffItem[] | null) => set({ directoryDiff: diff }),

  setSyncScroll: (sync: boolean) => set({ syncScroll: sync }),

  updateEditedContent: (side: 'left' | 'right', content: string) =>
    set((state) => ({
      editedContent: {
        ...state.editedContent,
        [side]: content,
      },
    })),

  reset: () => set(initialState),
}));
