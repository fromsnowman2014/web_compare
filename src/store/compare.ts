import { create } from 'zustand';
import type { CompareState, CompareActions, FileData, DiffResult, DirectoryDiffItem } from '@/types';
import { findNextDiffIndex, findPrevDiffIndex } from '@/lib/diff';

const initialState: CompareState = {
  leftFile: null,
  rightFile: null,
  diffResult: null,
  directoryDiff: null,
  currentDiffIndex: 0,
  syncScroll: true,
  viewMode: 'side-by-side',
  showOnlyDiffs: false,
  editMode: false,
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

  setDiffResult: (result: DiffResult | null) =>
    set({ diffResult: result, currentDiffIndex: 0 }),

  setDirectoryDiff: (diff: DirectoryDiffItem[] | null) => set({ directoryDiff: diff }),

  goToNextDiff: () => {
    const { diffResult, currentDiffIndex } = get();
    if (!diffResult) return;
    const nextIndex = findNextDiffIndex(diffResult.lines, currentDiffIndex);
    set({ currentDiffIndex: nextIndex });
  },

  goToPrevDiff: () => {
    const { diffResult, currentDiffIndex } = get();
    if (!diffResult) return;
    const prevIndex = findPrevDiffIndex(diffResult.lines, currentDiffIndex);
    set({ currentDiffIndex: prevIndex });
  },

  goToDiff: (index: number) => set({ currentDiffIndex: index }),

  setSyncScroll: (sync: boolean) => set({ syncScroll: sync }),

  setViewMode: (mode: 'side-by-side' | 'inline' | 'unified') => set({ viewMode: mode }),

  setShowOnlyDiffs: (show: boolean) => set({ showOnlyDiffs: show }),

  setEditMode: (edit: boolean) => set({ editMode: edit }),

  updateEditedContent: (side: 'left' | 'right', content: string) =>
    set((state) => ({
      editedContent: {
        ...state.editedContent,
        [side]: content,
      },
    })),

  copyToLeft: (lineIndex: number) => {
    const { diffResult, editedContent } = get();
    if (!diffResult) return;

    const line = diffResult.lines[lineIndex];
    if (!line || line.type === 'unchanged') return;

    const leftLines = editedContent.left.split('\n');
    const rightContent = line.content.right;

    if (line.type === 'added') {
      // Insert the added line from right to left
      if (line.lineNumber.left !== null) {
        leftLines.splice(line.lineNumber.left - 1, 0, rightContent);
      } else {
        // Find the appropriate position based on surrounding lines
        const prevLine = diffResult.lines
          .slice(0, lineIndex)
          .reverse()
          .find((l) => l.lineNumber.left !== null);
        const insertPos = prevLine ? prevLine.lineNumber.left! : 0;
        leftLines.splice(insertPos, 0, rightContent);
      }
    } else if (line.type === 'modified' && line.lineNumber.left !== null) {
      leftLines[line.lineNumber.left - 1] = rightContent;
    }

    set({
      editedContent: {
        ...editedContent,
        left: leftLines.join('\n'),
      },
    });
  },

  copyToRight: (lineIndex: number) => {
    const { diffResult, editedContent } = get();
    if (!diffResult) return;

    const line = diffResult.lines[lineIndex];
    if (!line || line.type === 'unchanged') return;

    const rightLines = editedContent.right.split('\n');
    const leftContent = line.content.left;

    if (line.type === 'removed') {
      // Insert the removed line from left to right
      if (line.lineNumber.right !== null) {
        rightLines.splice(line.lineNumber.right - 1, 0, leftContent);
      } else {
        const prevLine = diffResult.lines
          .slice(0, lineIndex)
          .reverse()
          .find((l) => l.lineNumber.right !== null);
        const insertPos = prevLine ? prevLine.lineNumber.right! : 0;
        rightLines.splice(insertPos, 0, leftContent);
      }
    } else if (line.type === 'modified' && line.lineNumber.right !== null) {
      rightLines[line.lineNumber.right - 1] = leftContent;
    }

    set({
      editedContent: {
        ...editedContent,
        right: rightLines.join('\n'),
      },
    });
  },

  copyAllToLeft: () => {
    const { editedContent } = get();
    set({
      editedContent: {
        ...editedContent,
        left: editedContent.right,
      },
    });
  },

  copyAllToRight: () => {
    const { editedContent } = get();
    set({
      editedContent: {
        ...editedContent,
        right: editedContent.left,
      },
    });
  },

  reset: () => set(initialState),
}));
