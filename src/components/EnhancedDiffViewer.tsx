'use client';

import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { useCompareStore } from '@/store/compare';
import { getLanguageFromFilename } from '@/lib/file';
import { computeTextDiff, getDiffBlocks, findNextDiffBlockIndex, findPrevDiffBlockIndex } from '@/lib/diff';
import { cn, formatBytes } from '@/lib/utils';
import type { DiffBlock, DiffLine } from '@/types';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  Eye,
  EyeOff,
  Download,
  FileText,
} from 'lucide-react';
import { downloadFile } from '@/lib/file';

const LINE_HEIGHT = 20; // pixels per line

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
  const [scrollTop, setScrollTop] = useState(0);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  // Compute diff when files change
  useEffect(() => {
    if (leftFile && rightFile && leftFile.type === 'text' && rightFile.type === 'text') {
      const leftContent = typeof leftFile.content === 'string' ? leftFile.content : '';
      const rightContent = typeof rightFile.content === 'string' ? rightFile.content : '';
      const result = computeTextDiff(leftContent, rightContent);
      setDiffResult(result);
    }
  }, [leftFile, rightFile, setDiffResult]);

  // Get diff blocks
  const diffBlocks = useMemo(() => {
    return diffResult?.blocks ? getDiffBlocks(diffResult.blocks) : [];
  }, [diffResult]);

  // Lines to display (filtered if showing only diffs)
  const displayLines = useMemo(() => {
    if (!diffResult) return [];
    if (!showOnlyDiffs) return diffResult.lines;

    // Show diff lines + context (2 lines before/after each diff block)
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

  // Synchronized scrolling
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>, source: 'left' | 'right') => {
    if (!syncScroll) return;
    const target = e.currentTarget;
    const newScrollTop = target.scrollTop;
    setScrollTop(newScrollTop);

    if (source === 'left' && rightPanelRef.current) {
      rightPanelRef.current.scrollTop = newScrollTop;
    } else if (source === 'right' && leftPanelRef.current) {
      leftPanelRef.current.scrollTop = newScrollTop;
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = newScrollTop;
    }
  }, [syncScroll]);

  // Navigation
  const goToNextBlock = useCallback(() => {
    if (!diffResult?.blocks) return;
    const nextIndex = findNextDiffBlockIndex(diffResult.blocks, currentBlockIndex);
    setCurrentBlockIndex(nextIndex);

    const block = diffResult.blocks[nextIndex];
    if (block && leftPanelRef.current) {
      const scrollPos = block.startIndex * LINE_HEIGHT;
      leftPanelRef.current.scrollTop = scrollPos;
      if (rightPanelRef.current) rightPanelRef.current.scrollTop = scrollPos;
      if (gutterRef.current) gutterRef.current.scrollTop = scrollPos;
      setScrollTop(scrollPos);
    }
  }, [diffResult, currentBlockIndex]);

  const goToPrevBlock = useCallback(() => {
    if (!diffResult?.blocks) return;
    const prevIndex = findPrevDiffBlockIndex(diffResult.blocks, currentBlockIndex);
    setCurrentBlockIndex(prevIndex);

    const block = diffResult.blocks[prevIndex];
    if (block && leftPanelRef.current) {
      const scrollPos = block.startIndex * LINE_HEIGHT;
      leftPanelRef.current.scrollTop = scrollPos;
      if (rightPanelRef.current) rightPanelRef.current.scrollTop = scrollPos;
      if (gutterRef.current) gutterRef.current.scrollTop = scrollPos;
      setScrollTop(scrollPos);
    }
  }, [diffResult, currentBlockIndex]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevBlock();
        } else {
          goToNextBlock();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextBlock, goToPrevBlock]);

  // Copy block to left
  const copyBlockToLeft = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks || !editedContent) return;
    const block = diffResult.blocks[blockIndex];
    if (!block || block.type === 'unchanged') return;

    const leftLines = editedContent.left.split('\n');
    const rightLines = editedContent.right.split('\n');

    // Get the content from right side for this block
    const rightContent = block.lines.map(l => l.content.right).filter(c => c !== '');

    if (block.type === 'added') {
      // Insert the added lines from right to left
      const insertPos = block.leftLineStart ? block.leftLineStart - 1 : leftLines.length;
      leftLines.splice(insertPos, 0, ...rightContent);
    } else if (block.type === 'removed') {
      // Keep the removed lines (no action needed, they're already in left)
    } else if (block.type === 'modified') {
      // Replace left content with right content
      if (block.leftLineStart && block.leftLineEnd) {
        const deleteCount = block.leftLineEnd - block.leftLineStart + 1;
        leftLines.splice(block.leftLineStart - 1, deleteCount, ...rightContent);
      }
    }

    updateEditedContent('left', leftLines.join('\n'));
  }, [diffResult, editedContent, updateEditedContent]);

  // Copy block to right
  const copyBlockToRight = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks || !editedContent) return;
    const block = diffResult.blocks[blockIndex];
    if (!block || block.type === 'unchanged') return;

    const leftLines = editedContent.left.split('\n');
    const rightLines = editedContent.right.split('\n');

    // Get the content from left side for this block
    const leftContent = block.lines.map(l => l.content.left).filter(c => c !== '');

    if (block.type === 'removed') {
      // Insert the removed lines from left to right
      const insertPos = block.rightLineStart ? block.rightLineStart - 1 : rightLines.length;
      rightLines.splice(insertPos, 0, ...leftContent);
    } else if (block.type === 'added') {
      // Delete the added lines from right
      if (block.rightLineStart && block.rightLineEnd) {
        const deleteCount = block.rightLineEnd - block.rightLineStart + 1;
        rightLines.splice(block.rightLineStart - 1, deleteCount);
      }
    } else if (block.type === 'modified') {
      // Replace right content with left content
      if (block.rightLineStart && block.rightLineEnd) {
        const deleteCount = block.rightLineEnd - block.rightLineStart + 1;
        rightLines.splice(block.rightLineStart - 1, deleteCount, ...leftContent);
      }
    }

    updateEditedContent('right', rightLines.join('\n'));
  }, [diffResult, editedContent, updateEditedContent]);

  // Delete block from left
  const deleteBlockFromLeft = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks || !editedContent) return;
    const block = diffResult.blocks[blockIndex];
    if (!block || block.type === 'unchanged' || block.type === 'added') return;

    const leftLines = editedContent.left.split('\n');

    if (block.leftLineStart && block.leftLineEnd) {
      const deleteCount = block.leftLineEnd - block.leftLineStart + 1;
      leftLines.splice(block.leftLineStart - 1, deleteCount);
    }

    updateEditedContent('left', leftLines.join('\n'));
  }, [diffResult, editedContent, updateEditedContent]);

  // Delete block from right
  const deleteBlockFromRight = useCallback((blockIndex: number) => {
    if (!diffResult?.blocks || !editedContent) return;
    const block = diffResult.blocks[blockIndex];
    if (!block || block.type === 'unchanged' || block.type === 'removed') return;

    const rightLines = editedContent.right.split('\n');

    if (block.rightLineStart && block.rightLineEnd) {
      const deleteCount = block.rightLineEnd - block.rightLineStart + 1;
      rightLines.splice(block.rightLineStart - 1, deleteCount);
    }

    updateEditedContent('right', rightLines.join('\n'));
  }, [diffResult, editedContent, updateEditedContent]);

  // Download handlers
  const handleDownloadLeft = useCallback(() => {
    if (leftFile) {
      downloadFile(editedContent.left, leftFile.name);
    }
  }, [leftFile, editedContent.left]);

  const handleDownloadRight = useCallback(() => {
    if (rightFile) {
      downloadFile(editedContent.right, rightFile.name);
    }
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
          {/* Navigation */}
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
          {/* View mode toggle */}
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

          {/* Sync scroll toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600"
            />
            Sync Scroll
          </label>

          {/* Download buttons */}
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

      {/* Main diff area with three columns */}
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
          className="w-12 bg-gray-800 border-x border-gray-700 overflow-auto flex-shrink-0 scrollbar-hide"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div style={{ minHeight: displayLines.length * LINE_HEIGHT }} className="relative">
            {diffResult?.blocks.map((block, blockIndex) => {
              if (block.type === 'unchanged') return null;

              const topOffset = block.startIndex * LINE_HEIGHT;
              const height = block.lines.length * LINE_HEIGHT;

              return (
                <div
                  key={blockIndex}
                  className="absolute flex flex-col items-center justify-center gap-0.5"
                  style={{
                    top: topOffset,
                    height: height,
                    width: 48,
                    left: 0,
                  }}
                >
                  {/* Copy to left button */}
                  {(block.type === 'added' || block.type === 'modified') && (
                    <button
                      onClick={() => copyBlockToLeft(blockIndex)}
                      className="p-0.5 bg-blue-600 hover:bg-blue-500 rounded text-white"
                      title="Copy to left"
                    >
                      <ChevronLeft className="w-3 h-3" />
                    </button>
                  )}

                  {/* Copy to right button */}
                  {(block.type === 'removed' || block.type === 'modified') && (
                    <button
                      onClick={() => copyBlockToRight(blockIndex)}
                      className="p-0.5 bg-green-600 hover:bg-green-500 rounded text-white"
                      title="Copy to right"
                    >
                      <ChevronRight className="w-3 h-3" />
                    </button>
                  )}

                  {/* Delete from left button */}
                  {(block.type === 'removed' || block.type === 'modified') && (
                    <button
                      onClick={() => deleteBlockFromLeft(blockIndex)}
                      className="p-0.5 bg-red-600 hover:bg-red-500 rounded text-white"
                      title="Delete from left"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
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

// Path Bar Component
function PathBar({ file, side }: { file: any; side: 'left' | 'right' }) {
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

// Individual diff line row
function DiffLineRow({
  line,
  side,
  lineHeight,
}: {
  line: DiffLine;
  side: 'left' | 'right';
  lineHeight: number;
}) {
  const lineNumber = side === 'left' ? line.lineNumber.left : line.lineNumber.right;
  const content = side === 'left' ? line.content.left : line.content.right;

  // Determine background color based on line type
  let bgClass = '';
  let textClass = 'text-gray-300';

  if (line.type === 'added') {
    if (side === 'right') {
      bgClass = 'bg-green-900/40';
      textClass = 'text-green-200';
    } else {
      bgClass = 'bg-gray-800/50';
      textClass = 'text-gray-600';
    }
  } else if (line.type === 'removed') {
    if (side === 'left') {
      bgClass = 'bg-red-900/40';
      textClass = 'text-red-200';
    } else {
      bgClass = 'bg-gray-800/50';
      textClass = 'text-gray-600';
    }
  } else if (line.type === 'modified') {
    bgClass = side === 'left' ? 'bg-yellow-900/30' : 'bg-yellow-900/30';
    textClass = 'text-yellow-100';
  }

  // Render character-level diffs if available
  const renderContent = () => {
    if (line.type === 'modified' && line.charDiffs) {
      const relevantDiffs = line.charDiffs.filter(d => d.side === side || d.type === 'unchanged');
      return relevantDiffs.map((charDiff, i) => {
        if (charDiff.type === 'unchanged') {
          return <span key={i}>{charDiff.value}</span>;
        } else if (charDiff.type === 'removed' && side === 'left') {
          return (
            <span key={i} className="bg-red-600/60 rounded px-0.5">
              {charDiff.value}
            </span>
          );
        } else if (charDiff.type === 'added' && side === 'right') {
          return (
            <span key={i} className="bg-green-600/60 rounded px-0.5">
              {charDiff.value}
            </span>
          );
        }
        return null;
      });
    }
    return content;
  };

  return (
    <div
      className={cn('flex', bgClass)}
      style={{ height: lineHeight, lineHeight: `${lineHeight}px` }}
    >
      {/* Line number */}
      <div className="w-12 flex-shrink-0 text-right pr-2 text-gray-500 select-none border-r border-gray-700 bg-gray-800/50">
        {lineNumber ?? ''}
      </div>
      {/* Content */}
      <div className={cn('flex-1 px-2 whitespace-pre overflow-hidden', textClass)}>
        {renderContent()}
      </div>
    </div>
  );
}
