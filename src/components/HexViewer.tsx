'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { useCompareStore } from '@/store/compare';
import { computeHexDiff } from '@/lib/diff';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, Download } from 'lucide-react';
import type { HexDiffLine } from '@/types';
import { downloadFile } from '@/lib/file';

const BYTES_PER_LINE = 16;

export function HexViewer() {
  const { leftFile, rightFile, syncScroll, setSyncScroll } = useCompareStore();
  const [currentDiffIndex, setCurrentDiffIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  const hexDiff = useMemo(() => {
    if (!leftFile || !rightFile) return null;

    const leftBuffer =
      leftFile.content instanceof ArrayBuffer
        ? leftFile.content
        : new TextEncoder().encode(leftFile.content as string).buffer;

    const rightBuffer =
      rightFile.content instanceof ArrayBuffer
        ? rightFile.content
        : new TextEncoder().encode(rightFile.content as string).buffer;

    return computeHexDiff(leftBuffer, rightBuffer, BYTES_PER_LINE);
  }, [leftFile, rightFile]);

  const diffLineIndices = useMemo(() => {
    if (!hexDiff) return [];
    return hexDiff.map((line, index) => (line.hasDiff ? index : -1)).filter((i) => i !== -1);
  }, [hexDiff]);

  // Synchronized scrolling
  useEffect(() => {
    if (!syncScroll) return;

    const left = leftRef.current;
    const right = rightRef.current;

    if (!left || !right) return;

    const syncLeft = () => {
      right.scrollTop = left.scrollTop;
    };

    const syncRight = () => {
      left.scrollTop = right.scrollTop;
    };

    left.addEventListener('scroll', syncLeft);
    right.addEventListener('scroll', syncRight);

    return () => {
      left.removeEventListener('scroll', syncLeft);
      right.removeEventListener('scroll', syncRight);
    };
  }, [syncScroll]);

  const goToNextDiff = useCallback(() => {
    if (diffLineIndices.length === 0) return;
    const next = (currentDiffIndex + 1) % diffLineIndices.length;
    setCurrentDiffIndex(next);

    const lineIndex = diffLineIndices[next];
    const element = containerRef.current?.querySelector(`[data-line="${lineIndex}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentDiffIndex, diffLineIndices]);

  const goToPrevDiff = useCallback(() => {
    if (diffLineIndices.length === 0) return;
    const prev = (currentDiffIndex - 1 + diffLineIndices.length) % diffLineIndices.length;
    setCurrentDiffIndex(prev);

    const lineIndex = diffLineIndices[prev];
    const element = containerRef.current?.querySelector(`[data-line="${lineIndex}"]`);
    element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [currentDiffIndex, diffLineIndices]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F7') {
        e.preventDefault();
        if (e.shiftKey) {
          goToPrevDiff();
        } else {
          goToNextDiff();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goToNextDiff, goToPrevDiff]);

  const handleDownloadLeft = useCallback(() => {
    if (leftFile) {
      downloadFile(leftFile.content, leftFile.name);
    }
  }, [leftFile]);

  const handleDownloadRight = useCallback(() => {
    if (rightFile) {
      downloadFile(rightFile.content, rightFile.name);
    }
  }, [rightFile]);

  if (!hexDiff) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select binary files to compare
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0" ref={containerRef}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrevDiff}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Previous difference (Shift+F7)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-400 min-w-[80px] text-center">
            {diffLineIndices.length > 0
              ? `${currentDiffIndex + 1} / ${diffLineIndices.length}`
              : 'No diffs'}
          </span>
          <button
            onClick={goToNextDiff}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Next difference (F7)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            Sync Scroll
          </label>
          <button
            onClick={handleDownloadLeft}
            className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-700 rounded transition-colors"
          >
            <Download className="w-4 h-4" />
            Left
          </button>
          <button
            onClick={handleDownloadRight}
            className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-700 rounded transition-colors"
          >
            <Download className="w-4 h-4" />
            Right
          </button>
        </div>
      </div>

      {/* Hex view */}
      <div className="flex-1 flex min-h-0">
        {/* Left side */}
        <div className="flex-1 flex flex-col border-r border-gray-700">
          <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-sm text-gray-400">
            {leftFile?.name || 'Left'} ({leftFile?.size} bytes)
          </div>
          <div
            ref={leftRef}
            className="flex-1 overflow-auto font-mono text-xs"
          >
            <table className="w-full border-collapse">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left text-gray-500 w-20">Offset</th>
                  <th className="px-2 py-1 text-left text-gray-500">Hex</th>
                  <th className="px-2 py-1 text-left text-gray-500 w-36">ASCII</th>
                </tr>
              </thead>
              <tbody>
                {hexDiff.map((line, index) => (
                  <HexRow
                    key={index}
                    line={line}
                    side="left"
                    lineIndex={index}
                    isHighlighted={diffLineIndices[currentDiffIndex] === index}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right side */}
        <div className="flex-1 flex flex-col">
          <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-sm text-gray-400">
            {rightFile?.name || 'Right'} ({rightFile?.size} bytes)
          </div>
          <div
            ref={rightRef}
            className="flex-1 overflow-auto font-mono text-xs"
          >
            <table className="w-full border-collapse">
              <thead className="bg-gray-800 sticky top-0">
                <tr>
                  <th className="px-2 py-1 text-left text-gray-500 w-20">Offset</th>
                  <th className="px-2 py-1 text-left text-gray-500">Hex</th>
                  <th className="px-2 py-1 text-left text-gray-500 w-36">ASCII</th>
                </tr>
              </thead>
              <tbody>
                {hexDiff.map((line, index) => (
                  <HexRow
                    key={index}
                    line={line}
                    side="right"
                    lineIndex={index}
                    isHighlighted={diffLineIndices[currentDiffIndex] === index}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

interface HexRowProps {
  line: HexDiffLine;
  side: 'left' | 'right';
  lineIndex: number;
  isHighlighted: boolean;
}

function HexRow({ line, side, lineIndex, isHighlighted }: HexRowProps) {
  const data = side === 'left' ? line.left : line.right;

  return (
    <tr
      data-line={lineIndex}
      className={cn(
        line.hasDiff && 'bg-yellow-900/20',
        isHighlighted && 'bg-blue-900/30'
      )}
    >
      <td className="px-2 py-0.5 text-gray-500">
        {line.offset.toString(16).padStart(8, '0').toUpperCase()}
      </td>
      <td className="px-2 py-0.5">
        <div className="flex flex-wrap gap-x-1">
          {data.hex.map((hex, i) => (
            <span
              key={i}
              className={cn(
                'inline-block w-5',
                line.diffPositions.includes(i) && 'text-red-400 font-bold'
              )}
            >
              {hex}
            </span>
          ))}
          {/* Pad empty spaces */}
          {Array.from({ length: BYTES_PER_LINE - data.hex.length }).map((_, i) => (
            <span key={`empty-${i}`} className="inline-block w-5">
              {'  '}
            </span>
          ))}
        </div>
      </td>
      <td className="px-2 py-0.5 text-green-400">
        {data.ascii.split('').map((char, i) => (
          <span
            key={i}
            className={cn(line.diffPositions.includes(i) && 'text-red-400 font-bold')}
          >
            {char}
          </span>
        ))}
      </td>
    </tr>
  );
}
