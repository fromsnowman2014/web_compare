export type FileType = 'text' | 'binary' | 'directory' | 'image';

export interface FileData {
  name: string;
  path: string;
  content: string | ArrayBuffer;
  type: FileType;
  size: number;
  lastModified?: number;
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

export interface DiffBlock {
  startIndex: number;
  endIndex: number;
  type: 'added' | 'removed' | 'modified' | 'unchanged';
  leftLineStart: number | null;
  leftLineEnd: number | null;
  rightLineStart: number | null;
  rightLineEnd: number | null;
  lines: DiffLine[];
}

export interface DiffResult {
  lines: DiffLine[];
  blocks: DiffBlock[];
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

export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  ignoreBlankLines: boolean;
  normalizeLineEndings: boolean;
}

export interface CompareState {
  leftFile: FileData | null;
  rightFile: FileData | null;
  diffResult: DiffResult | null;
  directoryDiff: DirectoryDiffItem[] | null;
  syncScroll: boolean;
  editedContent: {
    left: string;
    right: string;
  };
  diffOptions: DiffOptions;
  // Undo/Redo history
  history: {
    past: Array<{ left: string; right: string }>;
    future: Array<{ left: string; right: string }>;
  };
}

export interface CompareActions {
  setLeftFile: (file: FileData | null) => void;
  setRightFile: (file: FileData | null) => void;
  setDiffResult: (result: DiffResult | null) => void;
  setDirectoryDiff: (diff: DirectoryDiffItem[] | null) => void;
  setSyncScroll: (sync: boolean) => void;
  updateEditedContent: (side: 'left' | 'right', content: string) => void;
  setDiffOptions: (options: Partial<DiffOptions>) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  reset: () => void;
}
