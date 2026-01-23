'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useCompareStore } from '@/store/compare';
import { computeTextDiff, getDiffBlocks, findNextDiffBlockIndex, findPrevDiffBlockIndex } from '@/lib/diff';
import { cn, formatBytes } from '@/lib/utils';
import { downloadFile } from '@/lib/file';
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
} from 'lucide-react';

const LINE_HEIGHT = 20;

export function EnhancedDiffViewer() {
  const {
    leftFile,
    rightFile,
    diffResult,
    syncScroll,
    editedContent,
    setDiffResult,
    setSyncScroll,
    updateEditedContent,
  } = useCompareStore();

  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Compute diff from editedContent (not file content) so changes are reflected
  useEffect(() => {
    if (leftFile && rightFile && leftFile.type === 'text' && rightFile.type === 'text') {
      // Use editedContent which gets updated when copy/delete operations occur
      const leftContent = editedContent.left || (typeof leftFile.content === 'string' ? leftFile.content : '');
      const rightContent = editedContent.right || (typeof rightFile.content === 'string' ? rightFile.content : '');
      setDiffResult(computeTextDiff(leftContent, rightContent));
    }
  }, [leftFile, rightFile, editedContent.left, editedContent.right, setDiffResult]);

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

  const scrollToBlock = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks) return;
    const block = diffResult.blocks[blockIndex];
    if (!block) return;

    const scrollPos = block.startIndex * LINE_HEIGHT;
    if (leftPanelRef.current) leftPanelRef.current.scrollTop = scrollPos;
    if (rightPanelRef.current) rightPanelRef.current.scrollTop = scrollPos;
    if (gutterRef.current) gutterRef.current.scrollTop = scrollPos;
  }, [diffResult]);

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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        e.shiftKey ? goToPrevBlock() : goToNextBlock();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextBlock, goToPrevBlock]);

  // Find insertion position for added blocks (where to insert in left)
  const findLeftInsertPosition = useCallback((block: DiffBlock) => {
    if (!diffResult?.lines) return 0;

    // Look backwards from block start to find last line with left line number
    for (let i = block.startIndex - 1; i >= 0; i--) {
      const line = diffResult.lines[i];
      if (line.lineNumber.left !== null) {
        return line.lineNumber.left; // Insert after this line (0-indexed = line number)
      }
    }
    return 0; // Insert at beginning
  }, [diffResult]);

  // Find insertion position for removed blocks (where to insert in right)
  const findRightInsertPosition = useCallback((block: DiffBlock) => {
    if (!diffResult?.lines) return 0;

    // Look backwards from block start to find last line with right line number
    for (let i = block.startIndex - 1; i >= 0; i--) {
      const line = diffResult.lines[i];
      if (line.lineNumber.right !== null) {
        return line.lineNumber.right; // Insert after this line
      }
    }
    return 0; // Insert at beginning
  }, [diffResult]);

  // Copy block from right to left
  const copyBlockToLeft = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks) return;
    const block = diffResult.blocks[blockIndex];
    if (!block || block.type === 'unchanged' || block.type === 'removed') return;

    const leftLines = editedContent.left.split('\n');

    // Get content from right side
    const rightContent = block.lines
      .map(l => l.content.right)
      .filter(content => content !== '');

    if (rightContent.length === 0) return;

    if (block.type === 'added') {
      // Insert added lines from right into left
      const insertPos = findLeftInsertPosition(block);
      leftLines.splice(insertPos, 0, ...rightContent);
    } else if (block.type === 'modified' && block.leftLineStart && block.leftLineEnd) {
      // Replace left content with right content
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

    // Get content from left side
    const leftContent = block.lines
      .map(l => l.content.left)
      .filter(content => content !== '');

    if (leftContent.length === 0) return;

    if (block.type === 'removed') {
      // Insert removed lines from left into right
      const insertPos = findRightInsertPosition(block);
      rightLines.splice(insertPos, 0, ...leftContent);
    } else if (block.type === 'modified' && block.rightLineStart && block.rightLineEnd) {
      // Replace right content with left content
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

  if (!leftFile && !rightFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select files to compare
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
      {/* Path Bar */}
      <div className="flex border-b border-gray-700">
        <PathBar file={leftFile} side="left" />
        <PathBar file={rightFile} side="right" />
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
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
        </div>

        <div className="flex items-center gap-4">
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

      {/* Main diff area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left panel */}
        <div
          ref={leftPanelRef}
          className="flex-1 overflow-auto font-mono text-sm"
          onScroll={(e) => handleScroll(e, 'left')}
        >
          <div style={{ minHeight: displayLines.length * LINE_HEIGHT }}>
            {displayLines.map((line, index) => (
              <DiffLineRow key={index} line={line} side="left" lineHeight={LINE_HEIGHT} />
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

              // Determine which buttons to show based on block type
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
              <DiffLineRow key={index} line={line} side="right" lineHeight={LINE_HEIGHT} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function PathBar({ file, side }: { file: FileData | null; side: 'left' | 'right' }) {
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
          <div className="text-xs text-gray-500">
            {file.type} • {formatBytes(file.size)}
            {file.lastModified && ` • ${new Date(file.lastModified).toLocaleString()}`}
          </div>
        )}
      </div>
    </div>
  );
}

function DiffLineRow({ line, side, lineHeight }: { line: DiffLine; side: 'left' | 'right'; lineHeight: number }) {
  const lineNumber = side === 'left' ? line.lineNumber.left : line.lineNumber.right;
  const content = side === 'left' ? line.content.left : line.content.right;

  let bgClass = '';
  let textClass = 'text-gray-300';

  if (line.type === 'added') {
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
