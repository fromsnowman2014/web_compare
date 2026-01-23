'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { DiffEditor, Editor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useCompareStore } from '@/store/compare';
import { getLanguageFromFilename } from '@/lib/file';
import { computeTextDiff, getDiffIndices } from '@/lib/diff';
import { cn } from '@/lib/utils';
import {
  ChevronUp,
  ChevronDown,
  ArrowLeft,
  ArrowRight,
  Edit3,
  Eye,
  Download,
  RefreshCw,
} from 'lucide-react';
import { downloadFile } from '@/lib/file';

export function DiffViewer() {
  const {
    leftFile,
    rightFile,
    diffResult,
    currentDiffIndex,
    syncScroll,
    viewMode,
    editMode,
    editedContent,
    setDiffResult,
    goToNextDiff,
    goToPrevDiff,
    setSyncScroll,
    setViewMode,
    setEditMode,
    updateEditedContent,
    copyAllToLeft,
    copyAllToRight,
  } = useCompareStore();

  const diffEditorRef = useRef<editor.IStandaloneDiffEditor | null>(null);
  const leftEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const rightEditorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [diffIndices, setDiffIndices] = useState<number[]>([]);
  const [containerHeight, setContainerHeight] = useState<number>(400);

  const language = leftFile
    ? getLanguageFromFilename(leftFile.name)
    : rightFile
    ? getLanguageFromFilename(rightFile.name)
    : 'plaintext';

  // Measure container height for Monaco Editor
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const height = containerRef.current.clientHeight;
        console.log('[DiffViewer] Container height:', height);
        if (height > 0) {
          setContainerHeight(height);
        }
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    // Also update after a short delay to handle layout shifts
    const timeout = setTimeout(updateHeight, 100);

    return () => {
      window.removeEventListener('resize', updateHeight);
      clearTimeout(timeout);
    };
  }, []);

  // Compute diff when files change
  useEffect(() => {
    console.log('[DiffViewer] Files changed:', {
      leftFile: leftFile?.name,
      leftType: leftFile?.type,
      leftContentLength: typeof leftFile?.content === 'string' ? leftFile.content.length : 'binary',
      rightFile: rightFile?.name,
      rightType: rightFile?.type,
      rightContentLength: typeof rightFile?.content === 'string' ? rightFile.content.length : 'binary',
    });

    if (leftFile && rightFile && leftFile.type === 'text' && rightFile.type === 'text') {
      const leftContent = typeof leftFile.content === 'string' ? leftFile.content : '';
      const rightContent = typeof rightFile.content === 'string' ? rightFile.content : '';
      console.log('[DiffViewer] Computing diff, left length:', leftContent.length, 'right length:', rightContent.length);
      const result = computeTextDiff(leftContent, rightContent);
      console.log('[DiffViewer] Diff result:', result.stats);
      setDiffResult(result);
    }
  }, [leftFile, rightFile, setDiffResult]);

  // Update diff indices
  useEffect(() => {
    if (diffResult) {
      const indices = getDiffIndices(diffResult.lines);
      setDiffIndices(indices);
    }
  }, [diffResult]);

  // Handle keyboard shortcuts
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

  // Navigate to current diff
  useEffect(() => {
    if (diffEditorRef.current && diffResult && diffIndices.length > 0) {
      const lineIndex = diffIndices[currentDiffIndex];
      if (lineIndex !== undefined) {
        const line = diffResult.lines[lineIndex];
        const lineNumber = line.lineNumber.left ?? line.lineNumber.right ?? 1;
        diffEditorRef.current.revealLineInCenter(lineNumber);
      }
    }
  }, [currentDiffIndex, diffResult, diffIndices]);

  const handleDiffEditorMount = useCallback(
    (editor: editor.IStandaloneDiffEditor) => {
      console.log('[DiffViewer] DiffEditor mounted!');
      diffEditorRef.current = editor;

      // Force layout update after mount
      setTimeout(() => {
        editor.layout();
        console.log('[DiffViewer] Layout updated');
      }, 0);

      // Enable synchronized scrolling
      if (syncScroll) {
        const originalEditor = editor.getOriginalEditor();
        const modifiedEditor = editor.getModifiedEditor();

        originalEditor.onDidScrollChange((e) => {
          if (syncScroll) {
            modifiedEditor.setScrollTop(e.scrollTop);
            modifiedEditor.setScrollLeft(e.scrollLeft);
          }
        });
      }
    },
    [syncScroll]
  );

  const handleLeftEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    leftEditorRef.current = editor;
  }, []);

  const handleRightEditorMount = useCallback((editor: editor.IStandaloneCodeEditor) => {
    rightEditorRef.current = editor;
  }, []);

  const handleRecompute = useCallback(() => {
    const result = computeTextDiff(editedContent.left, editedContent.right);
    setDiffResult(result);
  }, [editedContent, setDiffResult]);

  const handleDownloadLeft = useCallback(() => {
    if (leftFile) {
      downloadFile(editedContent.left, `modified_${leftFile.name}`);
    }
  }, [leftFile, editedContent.left]);

  const handleDownloadRight = useCallback(() => {
    if (rightFile) {
      downloadFile(editedContent.right, `modified_${rightFile.name}`);
    }
  }, [rightFile, editedContent.right]);

  if (!leftFile && !rightFile) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        Select files to compare
      </div>
    );
  }

  const leftContent = editMode
    ? editedContent.left
    : typeof leftFile?.content === 'string'
    ? leftFile.content
    : '';

  const rightContent = editMode
    ? editedContent.right
    : typeof rightFile?.content === 'string'
    ? rightFile.content
    : '';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-2">
          {/* Navigation */}
          <button
            onClick={goToPrevDiff}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Previous difference (Shift+F7)"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-sm text-gray-400 min-w-[80px] text-center">
            {diffIndices.length > 0
              ? `${currentDiffIndex + 1} / ${diffIndices.length}`
              : 'No diffs'}
          </span>
          <button
            onClick={goToNextDiff}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Next difference (F7)"
          >
            <ChevronDown className="w-4 h-4" />
          </button>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* Copy buttons */}
          <button
            onClick={copyAllToLeft}
            className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-700 rounded transition-colors"
            title="Copy all to left"
          >
            <ArrowLeft className="w-4 h-4" />
            Copy to Left
          </button>
          <button
            onClick={copyAllToRight}
            className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-700 rounded transition-colors"
            title="Copy all to right"
          >
            Copy to Right
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* View mode */}
          <select
            value={viewMode}
            onChange={(e) => setViewMode(e.target.value as typeof viewMode)}
            className="px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="side-by-side">Side by Side</option>
            <option value="inline">Inline</option>
          </select>

          {/* Sync scroll toggle */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={syncScroll}
              onChange={(e) => setSyncScroll(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
            />
            Sync Scroll
          </label>

          <div className="w-px h-6 bg-gray-600 mx-2" />

          {/* Edit mode toggle */}
          <button
            onClick={() => setEditMode(!editMode)}
            className={cn(
              'flex items-center gap-1 px-3 py-1.5 text-sm rounded transition-colors',
              editMode ? 'bg-blue-600 text-white' : 'hover:bg-gray-700'
            )}
          >
            {editMode ? <Eye className="w-4 h-4" /> : <Edit3 className="w-4 h-4" />}
            {editMode ? 'View' : 'Edit'}
          </button>

          {editMode && (
            <>
              <button
                onClick={handleRecompute}
                className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-700 rounded transition-colors"
                title="Recompute diff"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
              <button
                onClick={handleDownloadLeft}
                className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-700 rounded transition-colors"
                title="Download left file"
              >
                <Download className="w-4 h-4" />
                Left
              </button>
              <button
                onClick={handleDownloadRight}
                className="flex items-center gap-1 px-3 py-1.5 text-sm hover:bg-gray-700 rounded transition-colors"
                title="Download right file"
              >
                <Download className="w-4 h-4" />
                Right
              </button>
            </>
          )}
        </div>
      </div>

      {/* Diff stats */}
      {diffResult && (
        <div className="flex items-center gap-4 px-4 py-2 bg-gray-850 border-b border-gray-700 text-sm">
          <span className="text-gray-400">
            Total: <span className="text-white">{diffResult.stats.totalLines}</span>
          </span>
          <span className="text-green-400">
            +{diffResult.stats.addedLines} added
          </span>
          <span className="text-red-400">
            -{diffResult.stats.removedLines} removed
          </span>
          <span className="text-yellow-400">
            ~{diffResult.stats.modifiedLines} modified
          </span>
          <span className="text-gray-400">
            {diffResult.stats.unchangedLines} unchanged
          </span>
        </div>
      )}

      {/* Editor container with measured height */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0"
        style={{ minHeight: '200px' }}
      >
        {editMode ? (
          <div className="flex h-full">
            {/* Left editor */}
            <div className="flex-1 flex flex-col border-r border-gray-700">
              <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-sm text-gray-400 flex-shrink-0">
                {leftFile?.name || 'Left'}
              </div>
              <div className="flex-1">
                <Editor
                  height={`${containerHeight - 36}px`}
                  language={language}
                  theme="vs-dark"
                  value={editedContent.left}
                  onChange={(value) => updateEditedContent('left', value || '')}
                  onMount={handleLeftEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    renderWhitespace: 'selection',
                    wordWrap: 'off',
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>
            {/* Right editor */}
            <div className="flex-1 flex flex-col">
              <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-sm text-gray-400 flex-shrink-0">
                {rightFile?.name || 'Right'}
              </div>
              <div className="flex-1">
                <Editor
                  height={`${containerHeight - 36}px`}
                  language={language}
                  theme="vs-dark"
                  value={editedContent.right}
                  onChange={(value) => updateEditedContent('right', value || '')}
                  onMount={handleRightEditorMount}
                  options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    lineNumbers: 'on',
                    scrollBeyondLastLine: false,
                    renderWhitespace: 'selection',
                    wordWrap: 'off',
                    automaticLayout: true,
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <DiffEditor
            height={`${containerHeight}px`}
            language={language}
            theme="vs-dark"
            original={leftContent}
            modified={rightContent}
            onMount={handleDiffEditorMount}
            options={{
              renderSideBySide: viewMode === 'side-by-side',
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              renderWhitespace: 'selection',
              readOnly: true,
              originalEditable: false,
              enableSplitViewResizing: true,
              ignoreTrimWhitespace: false,
              renderIndicators: true,
              renderMarginRevertIcon: false,
              automaticLayout: true,
            }}
          />
        )}
      </div>
    </div>
  );
}
