'use client';

import { useState, useCallback } from 'react';
import { FileDropzone } from '@/components/FileDropzone';
import { DiffViewer } from '@/components/DiffViewer';
import { HexViewer } from '@/components/HexViewer';
import { DirectoryViewer } from '@/components/DirectoryViewer';
import { useCompareStore } from '@/store/compare';
import type { FileData } from '@/types';
import { cn } from '@/lib/utils';
import { GitCompare, RotateCcw, Keyboard, X } from 'lucide-react';

type ViewMode = 'text' | 'binary' | 'directory';

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
  const [showShortcuts, setShowShortcuts] = useState(false);

  const handleLeftFileLoaded = useCallback(
    (file: FileData) => {
      setLeftFile(file);
      setLeftDirectoryFiles([]);
      if (file.type === 'binary' || file.type === 'image') {
        setViewMode('binary');
      } else {
        setViewMode('text');
      }
    },
    [setLeftFile]
  );

  const handleRightFileLoaded = useCallback(
    (file: FileData) => {
      setRightFile(file);
      setRightDirectoryFiles([]);
      if (file.type === 'binary' || file.type === 'image') {
        setViewMode('binary');
      } else {
        setViewMode('text');
      }
    },
    [setRightFile]
  );

  const handleLeftDirectoryLoaded = useCallback(
    (files: FileData[]) => {
      setLeftDirectoryFiles(files);
      setLeftFile(null);
      setViewMode('directory');
    },
    [setLeftFile]
  );

  const handleRightDirectoryLoaded = useCallback(
    (files: FileData[]) => {
      setRightDirectoryFiles(files);
      setRightFile(null);
      setViewMode('directory');
    },
    [setRightFile]
  );

  const handleDirectoryFileSelect = useCallback(
    (leftFile: FileData | undefined, rightFile: FileData | undefined) => {
      if (leftFile) setLeftFile(leftFile);
      if (rightFile) setRightFile(rightFile);

      const file = leftFile || rightFile;
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

  const handleReset = useCallback(() => {
    reset();
    setLeftDirectoryFiles([]);
    setRightDirectoryFiles([]);
    setViewMode('text');
  }, [reset]);

  const hasFiles = leftFile || rightFile;
  const hasDirectories = leftDirectoryFiles.length > 0 || rightDirectoryFiles.length > 0;

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
          {/* View mode tabs */}
          {(hasFiles || hasDirectories) && (
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
                disabled={!hasDirectories}
              >
                Directory
              </button>
            </div>
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
        {!hasFiles && !hasDirectories ? (
          /* File selection view */
          <div className="flex-1 flex gap-4 p-6">
            <div className="flex-1 flex flex-col">
              <h2 className="text-lg font-semibold mb-3 text-blue-400">Left (Original)</h2>
              <FileDropzone
                side="left"
                onFileLoaded={handleLeftFileLoaded}
                onDirectoryLoaded={handleLeftDirectoryLoaded}
                className="flex-1"
              />
            </div>
            <div className="flex-1 flex flex-col">
              <h2 className="text-lg font-semibold mb-3 text-green-400">Right (Modified)</h2>
              <FileDropzone
                side="right"
                onFileLoaded={handleRightFileLoaded}
                onDirectoryLoaded={handleRightDirectoryLoaded}
                className="flex-1"
              />
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
                    {leftFile?.name || (hasDirectories ? `${leftDirectoryFiles.length} files` : 'No file')}
                  </span>
                  {leftFile && (
                    <span className="text-xs text-gray-500">
                      ({leftFile.type}, {leftFile.size} bytes)
                    </span>
                  )}
                </div>
                {(leftFile || leftDirectoryFiles.length > 0) && (
                  <button
                    onClick={() => {
                      setLeftFile(null);
                      setLeftDirectoryFiles([]);
                    }}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="flex-1 flex items-center justify-between px-4 py-2 bg-gray-800/50">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-400 font-medium">
                    {rightFile?.name || (hasDirectories ? `${rightDirectoryFiles.length} files` : 'No file')}
                  </span>
                  {rightFile && (
                    <span className="text-xs text-gray-500">
                      ({rightFile.type}, {rightFile.size} bytes)
                    </span>
                  )}
                </div>
                {(rightFile || rightDirectoryFiles.length > 0) && (
                  <button
                    onClick={() => {
                      setRightFile(null);
                      setRightDirectoryFiles([]);
                    }}
                    className="p-1 hover:bg-gray-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Comparison content */}
            <div className="flex-1 min-h-0">
              {viewMode === 'directory' && hasDirectories ? (
                <DirectoryViewer
                  leftFiles={leftDirectoryFiles}
                  rightFiles={rightDirectoryFiles}
                  onFileSelect={handleDirectoryFileSelect}
                />
              ) : viewMode === 'binary' ? (
                <HexViewer />
              ) : (
                <DiffViewer />
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
