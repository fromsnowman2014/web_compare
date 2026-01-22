export type FileType = 'text' | 'binary' | 'directory' | 'image';

export interface FileData {
  name: string;
  path: string;
  content: string | ArrayBuffer;
  type: FileType;
  size: number;
  lastModified?: number;
  encoding?: string;
  children?: FileData[];
}

export interface DiffLine {
  lineNumber: {
    left: number | null;
    right: number | null;
  };
  content: {
    left: string;
    right: string;
  };
  type: 'unchanged' | 'added' | 'removed' | 'modified';
  charDiffs?: CharDiff[];
}

export interface CharDiff {
  type: 'unchanged' | 'added' | 'removed';
  value: string;
  side: 'left' | 'right';
}

export interface DiffResult {
  lines: DiffLine[];
  stats: DiffStats;
  isBinary: boolean;
}

export interface DiffStats {
  totalLines: number;
  addedLines: number;
  removedLines: number;
  modifiedLines: number;
  unchangedLines: number;
}

export interface DirectoryDiffItem {
  name: string;
  path: string;
  type: 'file' | 'directory';
  status: 'added' | 'removed' | 'modified' | 'unchanged' | 'conflict';
  leftFile?: FileData;
  rightFile?: FileData;
  children?: DirectoryDiffItem[];
}

export interface HexDiffLine {
  offset: number;
  left: {
    hex: string[];
    ascii: string;
    bytes: number[];
  };
  right: {
    hex: string[];
    ascii: string;
    bytes: number[];
  };
  hasDiff: boolean;
  diffPositions: number[];
}

export interface CompareState {
  leftFile: FileData | null;
  rightFile: FileData | null;
  diffResult: DiffResult | null;
  directoryDiff: DirectoryDiffItem[] | null;
  currentDiffIndex: number;
  syncScroll: boolean;
  viewMode: 'side-by-side' | 'inline' | 'unified';
  showOnlyDiffs: boolean;
  editMode: boolean;
  editedContent: {
    left: string;
    right: string;
  };
}

export interface CompareActions {
  setLeftFile: (file: FileData | null) => void;
  setRightFile: (file: FileData | null) => void;
  setDiffResult: (result: DiffResult | null) => void;
  setDirectoryDiff: (diff: DirectoryDiffItem[] | null) => void;
  goToNextDiff: () => void;
  goToPrevDiff: () => void;
  goToDiff: (index: number) => void;
  setSyncScroll: (sync: boolean) => void;
  setViewMode: (mode: 'side-by-side' | 'inline' | 'unified') => void;
  setShowOnlyDiffs: (show: boolean) => void;
  setEditMode: (edit: boolean) => void;
  updateEditedContent: (side: 'left' | 'right', content: string) => void;
  copyToLeft: (lineIndex: number) => void;
  copyToRight: (lineIndex: number) => void;
  copyAllToLeft: () => void;
  copyAllToRight: () => void;
  reset: () => void;
}
