'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useCompareStore } from '@/store/compare';
import { computeTextDiff, getDiffBlocks, findNextDiffBlockIndex, findPrevDiffBlockIndex, detectLineEndings } from '@/lib/diff';
import { cn, formatBytes } from '@/lib/utils';
import { downloadFile } from '@/lib/file';
import { useDebounce } from '@/hooks/useDebounce';
import type { DiffLine, DiffBlock, FileData } from '@/types';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Eye,
  EyeOff,
  Download,
  FileText,
  Edit3,
  GitCompare,
  Undo2,
  Redo2,
  Settings,
  Search,
  X,
} from 'lucide-react';

const LINE_HEIGHT = 20;
const DEBOUNCE_DELAY = 300; // ms

export function EnhancedDiffViewer() {
  const {
    leftFile,
    rightFile,
    diffResult,
    syncScroll,
    editedContent,
    diffOptions,
    setDiffResult,
    setSyncScroll,
    updateEditedContent,
    setDiffOptions,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useCompareStore();

  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ lineIndex: number; side: 'left' | 'right' }>>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [goToLineValue, setGoToLineValue] = useState('');
  const [showGoToLine, setShowGoToLine] = useState(false);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const leftTextareaRef = useRef<HTMLTextAreaElement>(null);
  const rightTextareaRef = useRef<HTMLTextAreaElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Debounce editedContent for diff computation to prevent lag during rapid typing
  const debouncedLeft = useDebounce(editedContent.left, DEBOUNCE_DELAY);
  const debouncedRight = useDebounce(editedContent.right, DEBOUNCE_DELAY);

  // Compute diff from debounced content
  useEffect(() => {
    if (leftFile && rightFile && leftFile.type === 'text' && rightFile.type === 'text') {
      const leftContent = debouncedLeft || (typeof leftFile.content === 'string' ? leftFile.content : '');
      const rightContent = debouncedRight || (typeof rightFile.content === 'string' ? rightFile.content : '');
      setDiffResult(computeTextDiff(leftContent, rightContent, diffOptions));
    }
  }, [leftFile, rightFile, debouncedLeft, debouncedRight, diffOptions, setDiffResult]);

  // Detect line endings for display
  const leftLineEndings = useMemo(() => detectLineEndings(editedContent.left), [editedContent.left]);
  const rightLineEndings = useMemo(() => detectLineEndings(editedContent.right), [editedContent.right]);

  const diffBlocks = useMemo(() => {
    return diffResult?.blocks ? getDiffBlocks(diffResult.blocks) : [];
  }, [diffResult]);

  const displayLines = useMemo(() => {
    if (!diffResult) return [];
    if (!showOnlyDiffs) return diffResult.lines;

    const contextLines = 2;
    const visibleIndices = new Set<number>();

    diffResult.blocks.forEach(block => {
      if (block.type !== 'unchanged') {
        for (let i = Math.max(0, block.startIndex - contextLines);
             i <= Math.min(diffResult.lines.length - 1, block.endIndex + contextLines);
             i++) {
          visibleIndices.add(i);
        }
      }
    });

    return diffResult.lines.filter((_, index) => visibleIndices.has(index));
  }, [diffResult, showOnlyDiffs]);

  // Search functionality
  useEffect(() => {
    if (!searchQuery || !diffResult) {
      setSearchResults([]);
      return;
    }

    const results: Array<{ lineIndex: number; side: 'left' | 'right' }> = [];
    const query = searchQuery.toLowerCase();

    diffResult.lines.forEach((line, index) => {
      if (line.content.left.toLowerCase().includes(query)) {
        results.push({ lineIndex: index, side: 'left' });
      }
      if (line.content.right.toLowerCase().includes(query) && line.content.right !== line.content.left) {
        results.push({ lineIndex: index, side: 'right' });
      }
    });

    setSearchResults(results);
    setCurrentSearchIndex(0);
  }, [searchQuery, diffResult]);

  // Synchronized scrolling for diff view
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>, source: 'left' | 'right') => {
    if (!syncScroll) return;
    const scrollTop = e.currentTarget.scrollTop;

    if (source === 'left') {
      if (rightPanelRef.current) rightPanelRef.current.scrollTop = scrollTop;
    } else {
      if (leftPanelRef.current) leftPanelRef.current.scrollTop = scrollTop;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = scrollTop;
  }, [syncScroll]);

  // Synchronized scrolling for edit mode
  const handleEditScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>, source: 'left' | 'right') => {
    if (!syncScroll) return;
    const scrollTop = e.currentTarget.scrollTop;

    if (source === 'left' && rightTextareaRef.current) {
      rightTextareaRef.current.scrollTop = scrollTop;
    } else if (source === 'right' && leftTextareaRef.current) {
      leftTextareaRef.current.scrollTop = scrollTop;
    }
  }, [syncScroll]);

  const scrollToLine = useCallback((lineIndex: number) => {
    const scrollPos = lineIndex * LINE_HEIGHT;
    if (leftPanelRef.current) leftPanelRef.current.scrollTop = scrollPos;
    if (rightPanelRef.current) rightPanelRef.current.scrollTop = scrollPos;
    if (gutterRef.current) gutterRef.current.scrollTop = scrollPos;
  }, []);

  const scrollToBlock = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks) return;
    const block = diffResult.blocks[blockIndex];
    if (!block) return;

    scrollToLine(block.startIndex);
  }, [diffResult, scrollToLine]);

  const goToNextBlock = useCallback(() => {
    if (!diffResult?.blocks) return;
    const nextIndex = findNextDiffBlockIndex(diffResult.blocks, currentBlockIndex);
    setCurrentBlockIndex(nextIndex);
    scrollToBlock(nextIndex);
  }, [diffResult, currentBlockIndex, scrollToBlock]);

  const goToPrevBlock = useCallback(() => {
    if (!diffResult?.blocks) return;
    const prevIndex = findPrevDiffBlockIndex(diffResult.blocks, currentBlockIndex);
    setCurrentBlockIndex(prevIndex);
    scrollToBlock(prevIndex);
  }, [diffResult, currentBlockIndex, scrollToBlock]);

  const goToNextSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const nextIndex = (currentSearchIndex + 1) % searchResults.length;
    setCurrentSearchIndex(nextIndex);
    scrollToLine(searchResults[nextIndex].lineIndex);
  }, [searchResults, currentSearchIndex, scrollToLine]);

  const goToPrevSearchResult = useCallback(() => {
    if (searchResults.length === 0) return;
    const prevIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(prevIndex);
    scrollToLine(searchResults[prevIndex].lineIndex);
  }, [searchResults, currentSearchIndex, scrollToLine]);

  const handleGoToLine = useCallback(() => {
    const lineNum = parseInt(goToLineValue, 10);
    if (isNaN(lineNum) || lineNum < 1 || !diffResult) return;

    // Find the line index for this line number
    const lineIndex = diffResult.lines.findIndex(
      line => line.lineNumber.left === lineNum || line.lineNumber.right === lineNum
    );

    if (lineIndex !== -1) {
      scrollToLine(lineIndex);
    }

    setShowGoToLine(false);
    setGoToLineValue('');
  }, [goToLineValue, diffResult, scrollToLine]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept shortcuts when in edit mode and typing
      if (editMode && (e.target instanceof HTMLTextAreaElement)) {
        // But allow Ctrl+Z, Ctrl+Y for undo/redo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault();
          if (e.shiftKey) {
            redo();
          } else {
            undo();
          }
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
          e.preventDefault();
          redo();
          return;
        }
        return;
      }

      // Global shortcuts
      if (e.key === 'F7') {
        e.preventDefault();
        e.shiftKey ? goToPrevBlock() : goToNextBlock();
      }

      // Ctrl+F for search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }

      // Ctrl+G for go to line
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        setShowGoToLine(true);
      }

      // Escape to close dialogs
      if (e.key === 'Escape') {
        setShowSearch(false);
        setShowGoToLine(false);
        setShowOptions(false);
      }

      // F3 for next search result
      if (e.key === 'F3') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevSearchResult();
        } else {
          goToNextSearchResult();
        }
      }

      // Ctrl+Z / Ctrl+Y for undo/redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextBlock, goToPrevBlock, goToNextSearchResult, goToPrevSearchResult, editMode, undo, redo]);

  // Find insertion position for added blocks (where to insert in left)
  const findLeftInsertPosition = useCallback((block: DiffBlock) => {
    if (!diffResult?.lines) return 0;

    for (let i = block.startIndex - 1; i >= 0; i--) {
      const line = diffResult.lines[i];
      if (line.lineNumber.left !== null) {
        return line.lineNumber.left;
      }
    }
    return 0;
  }, [diffResult]);

  // Find insertion position for removed blocks (where to insert in right)
  const findRightInsertPosition = useCallback((block: DiffBlock) => {
    if (!diffResult?.lines) return 0;

    for (let i = block.startIndex - 1; i >= 0; i--) {
      const line = diffResult.lines[i];
      if (line.lineNumber.right !== null) {
        return line.lineNumber.right;
      }
    }
    return 0;
  }, [diffResult]);

  // Copy block from right to left
  const copyBlockToLeft = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks) return;
    const block = diffResult.blocks[blockIndex];
    if (!block || block.type === 'unchanged' || block.type === 'removed') return;

    const leftLines = editedContent.left.split('\n');
    const rightContent = block.lines
      .map(l => l.content.right)
      .filter(content => content !== '');

    if (rightContent.length === 0) return;

    if (block.type === 'added') {
      const insertPos = findLeftInsertPosition(block);
      leftLines.splice(insertPos, 0, ...rightContent);
    } else if (block.type === 'modified' && block.leftLineStart && block.leftLineEnd) {
      const deleteCount = block.leftLineEnd - block.leftLineStart + 1;
      leftLines.splice(block.leftLineStart - 1, deleteCount, ...rightContent);
    }

    updateEditedContent('left', leftLines.join('\n'));
  }, [diffResult, editedContent.left, updateEditedContent, findLeftInsertPosition]);

  // Copy block from left to right
  const copyBlockToRight = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks) return;
    const block = diffResult.blocks[blockIndex];
    if (!block || block.type === 'unchanged' || block.type === 'added') return;

    const rightLines = editedContent.right.split('\n');
    const leftContent = block.lines
      .map(l => l.content.left)
      .filter(content => content !== '');

    if (leftContent.length === 0) return;

    if (block.type === 'removed') {
      const insertPos = findRightInsertPosition(block);
      rightLines.splice(insertPos, 0, ...leftContent);
    } else if (block.type === 'modified' && block.rightLineStart && block.rightLineEnd) {
      const deleteCount = block.rightLineEnd - block.rightLineStart + 1;
      rightLines.splice(block.rightLineStart - 1, deleteCount, ...leftContent);
    }

    updateEditedContent('right', rightLines.join('\n'));
  }, [diffResult, editedContent.right, updateEditedContent, findRightInsertPosition]);

  // Delete block from left side
  const deleteBlockFromLeft = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks) return;
    const block = diffResult.blocks[blockIndex];
    if (!block || block.type === 'unchanged' || block.type === 'added') return;

    if (block.leftLineStart !== null && block.leftLineEnd !== null) {
      const leftLines = editedContent.left.split('\n');
      const deleteCount = block.leftLineEnd - block.leftLineStart + 1;
      leftLines.splice(block.leftLineStart - 1, deleteCount);
      updateEditedContent('left', leftLines.join('\n'));
    }
  }, [diffResult, editedContent.left, updateEditedContent]);

  // Delete block from right side
  const deleteBlockFromRight = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks) return;
    const block = diffResult.blocks[blockIndex];
    if (!block || block.type === 'unchanged' || block.type === 'removed') return;

    if (block.rightLineStart !== null && block.rightLineEnd !== null) {
      const rightLines = editedContent.right.split('\n');
      const deleteCount = block.rightLineEnd - block.rightLineStart + 1;
      rightLines.splice(block.rightLineStart - 1, deleteCount);
      updateEditedContent('right', rightLines.join('\n'));
    }
  }, [diffResult, editedContent.right, updateEditedContent]);

  const handleDownloadLeft = useCallback(() => {
    if (leftFile) downloadFile(editedContent.left, leftFile.name);
  }, [leftFile, editedContent.left]);

  const handleDownloadRight = useCallback(() => {
    if (rightFile) downloadFile(editedContent.right, rightFile.name);
  }, [rightFile, editedContent.right]);

  // Handle text changes in edit mode
  const handleLeftTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateEditedContent('left', e.target.value);
  }, [updateEditedContent]);

  const handleRightTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    updateEditedContent('right', e.target.value);
  }, [updateEditedContent]);

  if (!leftFile && !rightFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select files to compare
      </div>
    );
  }

  // Empty file handling
  const leftEmpty = !editedContent.left || editedContent.left.trim() === '';
  const rightEmpty = !editedContent.right || editedContent.right.trim() === '';

  if (leftEmpty && rightEmpty) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-gray-500 gap-4">
        <FileText className="w-16 h-16 text-gray-600" />
        <div className="text-center">
          <p className="text-lg font-medium">Both files are empty</p>
          <p className="text-sm text-gray-600 mt-1">
            Switch to Edit Mode to add content
          </p>
        </div>
        <button
          onClick={() => setEditMode(true)}
          className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
        >
          Open Edit Mode
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
      {/* Path Bar */}
      <div className="flex border-b border-gray-700">
        <PathBar file={leftFile} side="left" lineEndings={leftLineEndings} />
        <PathBar file={rightFile} side="right" lineEndings={rightLineEndings} />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {/* Edit/Diff mode toggle */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors',
              editMode ? 'bg-orange-600 text-white' : 'hover:bg-gray-700'
            )}
            title={editMode ? 'Switch to Diff View' : 'Switch to Edit Mode'}
          >
            {editMode ? <GitCompare className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {editMode ? 'Diff View' : 'Edit Mode'}
          </button>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* Undo/Redo buttons */}
          <button
            onClick={undo}
            disabled={!canUndo()}
            className={cn(
              'p-2 rounded transition-colors',
              canUndo() ? 'hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'
            )}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </button>
          <button
            onClick={redo}
            disabled={!canRedo()}
            className={cn(
              'p-2 rounded transition-colors',
              canRedo() ? 'hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'
            )}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* Navigation - only show in diff mode */}
          {!editMode && (
            <>
              <button
                onClick={goToPrevBlock}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                title="Previous difference (Shift+F7)"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-400 min-w-[100px] text-center">
                {diffBlocks.length > 0
                  ? `Section ${currentBlockIndex + 1} / ${diffBlocks.length}`
                  : 'No differences'}
              </span>
              <button
                onClick={goToNextBlock}
                className="p-2 hover:bg-gray-700 rounded transition-colors"
                title="Next difference (F7)"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </>
          )}

          {editMode && (
            <span className="text-sm text-orange-400">
              Editing - changes update diff in real-time
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Search button */}
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              setTimeout(() => searchInputRef.current?.focus(), 0);
            }}
            className={cn(
              'p-2 rounded transition-colors',
              showSearch ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
            )}
            title="Search (Ctrl+F)"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Options button */}
          <button
            onClick={() => setShowOptions(!showOptions)}
            className={cn(
              'p-2 rounded transition-colors',
              showOptions ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
            )}
            title="Diff Options"
          >
            <Settings className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* View options - only in diff mode */}
          {!editMode && (
            <button
              onClick={() => setShowOnlyDiffs(!showOnlyDiffs)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 text-sm rounded transition-colors',
                showOnlyDiffs ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
              )}
              title={showOnlyDiffs ? 'Show all text' : 'Show differences only'}
            >
              {showOnlyDiffs ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              {showOnlyDiffs ? 'All Text' : 'Diffs Only'}
            </button>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
            />
            Sync Scroll
          </label>

          <button
            onClick={handleDownloadLeft}
            className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-700 rounded"
            title="Download left file"
          >
            <Download className="w-4 h-4" />
            Left
          </button>
          <button
            onClick={handleDownloadRight}
            className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-700 rounded"
            title="Download right file"
          >
            <Download className="w-4 h-4" />
            Right
          </button>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.shiftKey ? goToPrevSearchResult() : goToNextSearchResult();
              }
              if (e.key === 'Escape') {
                setShowSearch(false);
              }
            }}
            placeholder="Search... (Enter for next, Shift+Enter for prev)"
            className="flex-1 bg-gray-700 text-white px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-400 min-w-[80px]">
            {searchResults.length > 0
              ? `${currentSearchIndex + 1} / ${searchResults.length}`
              : 'No results'}
          </span>
          <button
            onClick={goToPrevSearchResult}
            disabled={searchResults.length === 0}
            className="p-1.5 hover:bg-gray-700 rounded disabled:opacity-50"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            onClick={goToNextSearchResult}
            disabled={searchResults.length === 0}
            className="p-1.5 hover:bg-gray-700 rounded disabled:opacity-50"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSearch(false)}
            className="p-1.5 hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Go to line dialog */}
      {showGoToLine && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-b border-gray-700">
          <span className="text-sm text-gray-400">Go to line:</span>
          <input
            type="number"
            value={goToLineValue}
            onChange={(e) => setGoToLineValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleGoToLine();
              if (e.key === 'Escape') setShowGoToLine(false);
            }}
            placeholder="Line number"
            className="w-32 bg-gray-700 text-white px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
          <button
            onClick={handleGoToLine}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 rounded text-sm"
          >
            Go
          </button>
          <button
            onClick={() => setShowGoToLine(false)}
            className="p-1.5 hover:bg-gray-700 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Options panel */}
      {showOptions && (
        <div className="px-4 py-3 bg-gray-800 border-b border-gray-700 flex items-center gap-6">
          <span className="text-sm text-gray-400 font-medium">Diff Options:</span>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={diffOptions.normalizeLineEndings}
              onChange={(e) => setDiffOptions({ normalizeLineEndings: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
            />
            Normalize Line Endings
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={diffOptions.ignoreWhitespace}
              onChange={(e) => setDiffOptions({ ignoreWhitespace: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
            />
            Ignore Whitespace
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={diffOptions.ignoreCase}
              onChange={(e) => setDiffOptions({ ignoreCase: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
            />
            Ignore Case
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={diffOptions.ignoreBlankLines}
              onChange={(e) => setDiffOptions({ ignoreBlankLines: e.target.checked })}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
            />
            Ignore Blank Lines
          </label>
        </div>
      )}

      {/* Diff stats */}
      {diffResult && (
        <div className="flex items-center gap-4 px-4 py-1.5 bg-gray-850 border-b border-gray-700 text-xs">
          <span className="text-gray-400">
            Total: <span className="text-white">{diffResult.stats.totalLines}</span>
          </span>
          <span className="text-green-400">+{diffResult.stats.addedLines} added</span>
          <span className="text-red-400">-{diffResult.stats.removedLines} removed</span>
          <span className="text-yellow-400">~{diffResult.stats.modifiedLines} modified</span>
          <span className="text-gray-400">{diffResult.stats.unchangedLines} unchanged</span>
        </div>
      )}

      {/* Main content area */}
      {editMode ? (
        /* Edit Mode - Two textareas side by side */
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left editor */}
          <div className="flex-1 flex flex-col border-r border-gray-700">
            <div className="px-3 py-1.5 bg-blue-900/30 border-b border-gray-700 text-xs text-blue-400 flex justify-between">
              <span>Editing: {leftFile?.name || 'Left'}</span>
              {leftEmpty && <span className="text-yellow-400">(Empty)</span>}
            </div>
            <textarea
              ref={leftTextareaRef}
              value={editedContent.left}
              onChange={handleLeftTextChange}
              onScroll={(e) => handleEditScroll(e, 'left')}
              className="flex-1 w-full p-3 bg-gray-900 text-gray-200 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
              spellCheck={false}
              placeholder="Enter or paste text here..."
            />
          </div>

          {/* Right editor */}
          <div className="flex-1 flex flex-col">
            <div className="px-3 py-1.5 bg-green-900/30 border-b border-gray-700 text-xs text-green-400 flex justify-between">
              <span>Editing: {rightFile?.name || 'Right'}</span>
              {rightEmpty && <span className="text-yellow-400">(Empty)</span>}
            </div>
            <textarea
              ref={rightTextareaRef}
              value={editedContent.right}
              onChange={handleRightTextChange}
              onScroll={(e) => handleEditScroll(e, 'right')}
              className="flex-1 w-full p-3 bg-gray-900 text-gray-200 font-mono text-sm resize-none focus:outline-none focus:ring-1 focus:ring-green-500"
              spellCheck={false}
              placeholder="Enter or paste text here..."
            />
          </div>
        </div>
      ) : (
        /* Diff View Mode */
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left panel */}
          <div
            ref={leftPanelRef}
            className="flex-1 overflow-auto font-mono text-sm"
            onScroll={(e) => handleScroll(e, 'left')}
          >
            <div style={{ minHeight: displayLines.length * LINE_HEIGHT }}>
              {displayLines.map((line, index) => (
                <DiffLineRow
                  key={index}
                  line={line}
                  side="left"
                  lineHeight={LINE_HEIGHT}
                  isSearchMatch={searchResults.some(
                    r => r.lineIndex === index && r.side === 'left'
                  )}
                  isCurrentSearchMatch={
                    searchResults[currentSearchIndex]?.lineIndex === index &&
                    searchResults[currentSearchIndex]?.side === 'left'
                  }
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          </div>

          {/* Center gutter with action buttons */}
          <div
            ref={gutterRef}
            className="w-14 bg-gray-800 border-x border-gray-700 overflow-auto flex-shrink-0"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <div style={{ minHeight: displayLines.length * LINE_HEIGHT }} className="relative">
              {diffResult?.blocks.map((block, blockIndex) => {
                if (block.type === 'unchanged') return null;

                const showCopyToLeft = block.type === 'added' || block.type === 'modified';
                const showCopyToRight = block.type === 'removed' || block.type === 'modified';
                const showDeleteLeft = block.type === 'removed' || block.type === 'modified';
                const showDeleteRight = block.type === 'added' || block.type === 'modified';

                return (
                  <div
                    key={blockIndex}
                    className="absolute flex flex-col items-center justify-center gap-0.5 py-0.5"
                    style={{
                      top: block.startIndex * LINE_HEIGHT,
                      height: block.lines.length * LINE_HEIGHT,
                      width: 56,
                      left: 0,
                    }}
                  >
                    {/* Copy buttons row */}
                    <div className="flex gap-0.5">
                      {showCopyToLeft && (
                        <button
                          onClick={() => copyBlockToLeft(blockIndex)}
                          className="p-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white"
                          title="Copy to left (←)"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                      )}
                      {showCopyToRight && (
                        <button
                          onClick={() => copyBlockToRight(blockIndex)}
                          className="p-0.5 bg-green-600 hover:bg-green-500 rounded text-white"
                          title="Copy to right (→)"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    {/* Delete buttons row */}
                    <div className="flex gap-0.5">
                      {showDeleteLeft && (
                        <button
                          onClick={() => deleteBlockFromLeft(blockIndex)}
                          className="p-0.5 bg-red-700 hover:bg-red-600 rounded text-white"
                          title="Delete from left"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                      {showDeleteRight && (
                        <button
                          onClick={() => deleteBlockFromRight(blockIndex)}
                          className="p-0.5 bg-red-500 hover:bg-red-400 rounded text-white"
                          title="Delete from right"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right panel */}
          <div
            ref={rightPanelRef}
            className="flex-1 overflow-auto font-mono text-sm"
            onScroll={(e) => handleScroll(e, 'right')}
          >
            <div style={{ minHeight: displayLines.length * LINE_HEIGHT }}>
              {displayLines.map((line, index) => (
                <DiffLineRow
                  key={index}
                  line={line}
                  side="right"
                  lineHeight={LINE_HEIGHT}
                  isSearchMatch={searchResults.some(
                    r => r.lineIndex === index && r.side === 'right'
                  )}
                  isCurrentSearchMatch={
                    searchResults[currentSearchIndex]?.lineIndex === index &&
                    searchResults[currentSearchIndex]?.side === 'right'
                  }
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PathBar({
  file,
  side,
  lineEndings,
}: {
  file: FileData | null;
  side: 'left' | 'right';
  lineEndings: string;
}) {
  const bgColor = side === 'left' ? 'bg-blue-900/30' : 'bg-green-900/30';
  const textColor = side === 'left' ? 'text-blue-400' : 'text-green-400';

  return (
    <div className={cn('flex-1 flex items-center gap-2 px-3 py-2', bgColor)}>
      <FileText className={cn('w-4 h-4 flex-shrink-0', textColor)} />
      <div className="flex-1 min-w-0">
        <div className={cn('text-sm font-medium truncate', textColor)}>
          {file?.name || 'No file selected'}
        </div>
        {file && (
          <div className="text-xs text-gray-500 flex items-center gap-2">
            <span>{file.type} • {formatBytes(file.size)}</span>
            {lineEndings !== 'None' && (
              <span className="text-gray-600">• {lineEndings}</span>
            )}
            {file.lastModified && (
              <span>• {new Date(file.lastModified).toLocaleString()}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DiffLineRow({
  line,
  side,
  lineHeight,
  isSearchMatch,
  isCurrentSearchMatch,
  searchQuery,
}: {
  line: DiffLine;
  side: 'left' | 'right';
  lineHeight: number;
  isSearchMatch?: boolean;
  isCurrentSearchMatch?: boolean;
  searchQuery?: string;
}) {
  const lineNumber = side === 'left' ? line.lineNumber.left : line.lineNumber.right;
  const content = side === 'left' ? line.content.left : line.content.right;

  let bgClass = '';
  let textClass = 'text-gray-300';

  if (isCurrentSearchMatch) {
    bgClass = 'bg-yellow-500/40';
  } else if (isSearchMatch) {
    bgClass = 'bg-yellow-500/20';
  } else if (line.type === 'added') {
    bgClass = side === 'right' ? 'bg-green-900/40' : 'bg-gray-800/50';
    textClass = side === 'right' ? 'text-green-200' : 'text-gray-600';
  } else if (line.type === 'removed') {
    bgClass = side === 'left' ? 'bg-red-900/40' : 'bg-gray-800/50';
    textClass = side === 'left' ? 'text-red-200' : 'text-gray-600';
  } else if (line.type === 'modified') {
    bgClass = 'bg-yellow-900/30';
    textClass = 'text-yellow-100';
  }

  const renderContent = () => {
    // Highlight search query matches
    if (searchQuery && content.toLowerCase().includes(searchQuery.toLowerCase())) {
      const parts: React.ReactNode[] = [];
      const lowerContent = content.toLowerCase();
      const lowerQuery = searchQuery.toLowerCase();
      let lastIndex = 0;

      let index = lowerContent.indexOf(lowerQuery);
      while (index !== -1) {
        if (index > lastIndex) {
          parts.push(content.slice(lastIndex, index));
        }
        parts.push(
          <span key={index} className="bg-yellow-400 text-black rounded px-0.5">
            {content.slice(index, index + searchQuery.length)}
          </span>
        );
        lastIndex = index + searchQuery.length;
        index = lowerContent.indexOf(lowerQuery, lastIndex);
      }

      if (lastIndex < content.length) {
        parts.push(content.slice(lastIndex));
      }

      return parts;
    }

    if (line.type === 'modified' && line.charDiffs) {
      return line.charDiffs
        .filter(d => d.side === side || d.type === 'unchanged')
        .map((charDiff, i) => {
          if (charDiff.type === 'unchanged') {
            return <span key={i}>{charDiff.value}</span>;
          } else if (charDiff.type === 'removed' && side === 'left') {
            return <span key={i} className="bg-red-600/60 rounded px-0.5">{charDiff.value}</span>;
          } else if (charDiff.type === 'added' && side === 'right') {
            return <span key={i} className="bg-green-600/60 rounded px-0.5">{charDiff.value}</span>;
          }
          return null;
        });
    }
    return content;
  };

  return (
    <div className={cn('flex', bgClass)} style={{ height: lineHeight, lineHeight: `${lineHeight}px` }}>
      <div className="w-12 flex-shrink-0 text-right pr-2 text-gray-500 select-none border-r border-gray-700 bg-gray-800/50">
        {lineNumber ?? ''}
      </div>
      <div className={cn('flex-1 px-2 whitespace-pre overflow-hidden', textClass)}>
        {renderContent()}
      </div>
    </div>
  );
}
