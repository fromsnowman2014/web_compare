'use client';

import { useState, useCallback } from 'react';
import { FileDropzone, DropItem } from '@/components/FileDropzone';
import { EnhancedDiffViewer } from '@/components/EnhancedDiffViewer';
import { HexViewer } from '@/components/HexViewer';
import { DirectoryViewer } from '@/components/DirectoryViewer';
import { useCompareStore } from '@/store/compare';
import type { FileData } from '@/types';
import { cn } from '@/lib/utils';
import { GitCompare, RotateCcw, Keyboard, X, Play } from 'lucide-react';

type ViewMode = 'text' | 'binary' | 'directory';
type AppMode = 'upload' | 'compare';

export default function Home() {
  const {
    leftFile,
    rightFile,
    setLeftFile,
    setRightFile,
    reset,
  } = useCompareStore();

  const [leftDirectoryFiles, setLeftDirectoryFiles] = useState<FileData[]>([]);
  const [rightDirectoryFiles, setRightDirectoryFiles] = useState<FileData[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('text');
  const [appMode, setAppMode] = useState<AppMode>('upload');
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Check if content exists on each side
  const hasLeftContent = leftFile || leftDirectoryFiles.length > 0;
  const hasRightContent = rightFile || rightDirectoryFiles.length > 0;
  const hasBothContent = hasLeftContent && hasRightContent;

  // Determine if we should show directory view (any side has directory)
  const shouldShowDirectoryView = leftDirectoryFiles.length > 0 || rightDirectoryFiles.length > 0;

  const handleLeftFileLoaded = useCallback(
    (file: FileData) => {
      setLeftFile(file);
      setLeftDirectoryFiles([]);
    },
    [setLeftFile]
  );

  const handleRightFileLoaded = useCallback(
    (file: FileData) => {
      setRightFile(file);
      setRightDirectoryFiles([]);
    },
    [setRightFile]
  );

  const handleLeftDirectoryLoaded = useCallback(
    (files: FileData[]) => {
      setLeftDirectoryFiles(files);
      setLeftFile(null);
    },
    [setLeftFile]
  );

  const handleRightDirectoryLoaded = useCallback(
    (files: FileData[]) => {
      setRightDirectoryFiles(files);
      setRightFile(null);
    },
    [setRightFile]
  );

  // Handle multi-drop: distribute items based on modification time
  const handleMultiDrop = useCallback(
    (items: DropItem[]) => {
      if (items.length < 2) return;

      // Sort by modification time (oldest first = left, newest = right)
      const sorted = [...items].sort((a, b) => {
        const aTime = a.lastModified || 0;
        const bTime = b.lastModified || 0;
        return aTime - bTime;
      });

      const leftItem = sorted[0];
      const rightItem = sorted[1];

      // Set left side
      if (leftItem.type === 'file') {
        setLeftFile(leftItem.data as FileData);
        setLeftDirectoryFiles([]);
      } else {
        setLeftDirectoryFiles(leftItem.data as FileData[]);
        setLeftFile(null);
      }

      // Set right side
      if (rightItem.type === 'file') {
        setRightFile(rightItem.data as FileData);
        setRightDirectoryFiles([]);
      } else {
        setRightDirectoryFiles(rightItem.data as FileData[]);
        setRightFile(null);
      }
    },
    [setLeftFile, setRightFile]
  );

  const handleDirectoryFileSelect = useCallback(
    (left: FileData | undefined, right: FileData | undefined) => {
      if (left) setLeftFile(left);
      if (right) setRightFile(right);

      const file = left || right;
      if (file) {
        if (file.type === 'binary' || file.type === 'image') {
          setViewMode('binary');
        } else {
          setViewMode('text');
        }
      }
    },
    [setLeftFile, setRightFile]
  );

  const handleClearLeft = useCallback(() => {
    setLeftFile(null);
    setLeftDirectoryFiles([]);
  }, [setLeftFile]);

  const handleClearRight = useCallback(() => {
    setRightFile(null);
    setRightDirectoryFiles([]);
  }, [setRightFile]);

  const handleReset = useCallback(() => {
    reset();
    setLeftDirectoryFiles([]);
    setRightDirectoryFiles([]);
    setViewMode('text');
    setAppMode('upload');
  }, [reset]);

  const handleStartCompare = useCallback(() => {
    // Determine view mode based on content
    if (shouldShowDirectoryView) {
      setViewMode('directory');
    } else if (
      (leftFile?.type === 'binary' || leftFile?.type === 'image') ||
      (rightFile?.type === 'binary' || rightFile?.type === 'image')
    ) {
      setViewMode('binary');
    } else {
      setViewMode('text');
    }
    setAppMode('compare');
  }, [shouldShowDirectoryView, leftFile, rightFile]);

  const handleBackToUpload = useCallback(() => {
    setAppMode('upload');
  }, []);

  return (
    <main className="h-screen flex flex-col bg-gray-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-3">
          <GitCompare className="w-8 h-8 text-blue-400" />
          <div>
            <h1 className="text-xl font-bold">Web Compare</h1>
            <p className="text-xs text-gray-400">File & Directory Comparison Tool</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* View mode tabs - only show in compare mode */}
          {appMode === 'compare' && (
            <div className="flex bg-gray-700 rounded-lg p-1">
              <button
                onClick={() => setViewMode('text')}
                className={cn(
                  'px-3 py-1 text-sm rounded transition-colors',
                  viewMode === 'text' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
                )}
              >
                Text
              </button>
              <button
                onClick={() => setViewMode('binary')}
                className={cn(
                  'px-3 py-1 text-sm rounded transition-colors',
                  viewMode === 'binary' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
                )}
              >
                Binary
              </button>
              <button
                onClick={() => setViewMode('directory')}
                className={cn(
                  'px-3 py-1 text-sm rounded transition-colors',
                  viewMode === 'directory' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
                )}
                disabled={!shouldShowDirectoryView}
              >
                Directory
              </button>
            </div>
          )}

          {/* Back to upload button - only in compare mode */}
          {appMode === 'compare' && (
            <button
              onClick={handleBackToUpload}
              className="px-3 py-1.5 text-sm bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Change Files
            </button>
          )}

          <button
            onClick={() => setShowShortcuts(true)}
            className="p-2 hover:bg-gray-700 rounded transition-colors"
            title="Keyboard shortcuts"
          >
            <Keyboard className="w-5 h-5" />
          </button>

          <button
            onClick={handleReset}
            className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Reset
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-h-0">
        {appMode === 'upload' ? (
          /* Upload view - always show until user clicks Compare */
          <div className="flex-1 flex flex-col">
            <div className="flex-1 flex gap-4 p-6">
              {/* Left dropzone */}
              <div className="flex-1 flex flex-col">
                <h2 className="text-lg font-semibold mb-3 text-blue-400">Left (Original)</h2>
                <FileDropzone
                  side="left"
                  onFileLoaded={handleLeftFileLoaded}
                  onDirectoryLoaded={handleLeftDirectoryLoaded}
                  onMultiDrop={handleMultiDrop}
                  currentFile={leftFile}
                  currentDirectory={leftDirectoryFiles}
                  onClear={handleClearLeft}
                  className="flex-1"
                />
              </div>

              {/* Right dropzone */}
              <div className="flex-1 flex flex-col">
                <h2 className="text-lg font-semibold mb-3 text-green-400">Right (Modified)</h2>
                <FileDropzone
                  side="right"
                  onFileLoaded={handleRightFileLoaded}
                  onDirectoryLoaded={handleRightDirectoryLoaded}
                  onMultiDrop={handleMultiDrop}
                  currentFile={rightFile}
                  currentDirectory={rightDirectoryFiles}
                  onClear={handleClearRight}
                  className="flex-1"
                />
              </div>
            </div>

            {/* Compare button - shows when both sides have content */}
            <div className="px-6 pb-6">
              <button
                onClick={handleStartCompare}
                disabled={!hasBothContent}
                className={cn(
                  'w-full flex items-center justify-center gap-2 py-3 rounded-lg text-lg font-semibold transition-all',
                  hasBothContent
                    ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                )}
              >
                <Play className="w-5 h-5" />
                {hasBothContent
                  ? 'Compare Files'
                  : hasLeftContent
                  ? 'Drop or select a file on the right side'
                  : hasRightContent
                  ? 'Drop or select a file on the left side'
                  : 'Drop or select files to compare'}
              </button>
            </div>
          </div>
        ) : (
          /* Comparison view */
          <div className="flex-1 flex flex-col min-h-0">
            {/* File info bar */}
            <div className="flex border-b border-gray-700">
              <div className="flex-1 flex items-center justify-between px-4 py-2 bg-gray-800/50 border-r border-gray-700">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-blue-400 font-medium">
                    {leftFile?.name || (leftDirectoryFiles.length > 0 ? `${leftDirectoryFiles.length} files` : 'No file')}
                  </span>
                  {leftFile && (
                    <span className="text-xs text-gray-500">
                      ({leftFile.type}, {leftFile.size} bytes)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-1 flex items-center justify-between px-4 py-2 bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-400 font-medium">
                    {rightFile?.name || (rightDirectoryFiles.length > 0 ? `${rightDirectoryFiles.length} files` : 'No file')}
                  </span>
                  {rightFile && (
                    <span className="text-xs text-gray-500">
                      ({rightFile.type}, {rightFile.size} bytes)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Comparison content */}
            <div className="flex-1 min-h-0">
              {viewMode === 'directory' && shouldShowDirectoryView ? (
                <DirectoryViewer
                  leftFiles={leftDirectoryFiles.length > 0 ? leftDirectoryFiles : (leftFile ? [leftFile] : [])}
                  rightFiles={rightDirectoryFiles.length > 0 ? rightDirectoryFiles : (rightFile ? [rightFile] : [])}
                  onFileSelect={handleDirectoryFileSelect}
                />
              ) : viewMode === 'binary' ? (
                <HexViewer />
              ) : (
                <EnhancedDiffViewer />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Keyboard shortcuts modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Keyboard Shortcuts</h2>
              <button
                onClick={() => setShowShortcuts(false)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <ShortcutItem shortcut="F7" description="Go to next difference" />
              <ShortcutItem shortcut="Shift + F7" description="Go to previous difference" />
              <ShortcutItem shortcut="Ctrl + S" description="Download current file (in edit mode)" />
              <ShortcutItem shortcut="Ctrl + Z" description="Undo (in edit mode)" />
              <ShortcutItem shortcut="Ctrl + Shift + Z" description="Redo (in edit mode)" />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function ShortcutItem({ shortcut, description }: { shortcut: string; description: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-300">{description}</span>
      <kbd className="px-2 py-1 bg-gray-700 rounded text-sm font-mono">{shortcut}</kbd>
    </div>
  );
}
