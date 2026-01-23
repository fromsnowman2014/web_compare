'use client';

import { useCallback, useState } from 'react';
import { Upload, Link, FolderOpen, File, Folder, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileData } from '@/types';
import { processFile, fetchFileFromUrl } from '@/lib/file';
import { formatBytes } from '@/lib/utils';

export interface DropItem {
  type: 'file' | 'directory';
  data: FileData | FileData[];
  lastModified?: number;
}

interface FileDropzoneProps {
  side: 'left' | 'right';
  onFileLoaded: (file: FileData) => void;
  onDirectoryLoaded?: (files: FileData[]) => void;
  onMultiDrop?: (items: DropItem[]) => void;
  currentFile?: FileData | null;
  currentDirectory?: FileData[];
  onClear?: () => void;
  className?: string;
}

export function FileDropzone({
  side,
  onFileLoaded,
  onDirectoryLoaded,
  onMultiDrop,
  currentFile,
  currentDirectory,
  onClear,
  className,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const hasContent = currentFile || (currentDirectory && currentDirectory.length > 0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setError(null);
      setIsLoading(true);

      try {
        const items = e.dataTransfer.items;
        const entries: FileSystemEntry[] = [];

        // Collect all entries
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry();
          if (entry) {
            entries.push(entry);
          }
        }

        // If 2+ items are dropped and we have a multi-drop handler
        if (entries.length >= 2 && onMultiDrop) {
          const dropItems: DropItem[] = [];

          for (const entry of entries) {
            if (entry.isDirectory) {
              const files = await processDirectoryEntry(entry as FileSystemDirectoryEntry, entry.name);
              // Get the oldest modification time from files
              const oldestModified = files.reduce(
                (oldest, f) => Math.min(oldest, f.lastModified || Date.now()),
                Date.now()
              );
              dropItems.push({
                type: 'directory',
                data: files,
                lastModified: oldestModified,
              });
            } else {
              const file = await getFileFromEntry(entry as FileSystemFileEntry);
              if (file) {
                const fileData = await processFile(file);
                dropItems.push({
                  type: 'file',
                  data: fileData,
                  lastModified: file.lastModified,
                });
              }
            }
          }

          onMultiDrop(dropItems);
          return;
        }

        // Single item handling
        if (entries.length === 1 && entries[0].isDirectory) {
          const files = await processDirectoryEntry(
            entries[0] as FileSystemDirectoryEntry,
            entries[0].name
          );
          onDirectoryLoaded?.(files);
        } else if (entries.length >= 1) {
          // Single file or multiple files as directory
          if (entries.length === 1 && entries[0].isFile) {
            const file = e.dataTransfer.files[0];
            if (file) {
              const fileData = await processFile(file);
              onFileLoaded(fileData);
            }
          } else {
            // Multiple files - treat as a virtual directory
            const fileDataList: FileData[] = [];
            for (let i = 0; i < e.dataTransfer.files.length; i++) {
              const fileData = await processFile(e.dataTransfer.files[i], '');
              fileDataList.push(fileData);
            }
            onDirectoryLoaded?.(fileDataList);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file');
      } finally {
        setIsLoading(false);
      }
    },
    [onFileLoaded, onDirectoryLoaded, onMultiDrop]
  );

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      setError(null);
      setIsLoading(true);

      try {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        if (files.length === 1) {
          const fileData = await processFile(files[0]);
          onFileLoaded(fileData);
        } else {
          // Multiple files selected (directory)
          const fileDataList: FileData[] = [];
          for (let i = 0; i < files.length; i++) {
            const fileData = await processFile(files[i], '');
            fileDataList.push(fileData);
          }
          onDirectoryLoaded?.(fileDataList);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file');
      } finally {
        setIsLoading(false);
        e.target.value = '';
      }
    },
    [onFileLoaded, onDirectoryLoaded]
  );

  const handleUrlFetch = useCallback(async () => {
    if (!url.trim()) return;

    setError(null);
    setIsLoading(true);

    try {
      const fileData = await fetchFileFromUrl(url.trim());
      onFileLoaded(fileData);
      setUrl('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch URL');
    } finally {
      setIsLoading(false);
    }
  }, [url, onFileLoaded]);

  // If content is already loaded, show the loaded state
  if (hasContent) {
    return (
      <div className={cn('flex flex-col gap-3', className)}>
        <div
          className={cn(
            'flex-1 flex flex-col items-center justify-center p-6 border-2 rounded-lg transition-colors',
            isDragging
              ? 'border-blue-500 bg-blue-500/10 border-dashed'
              : 'border-gray-600 bg-gray-800/50',
            isLoading && 'opacity-50 pointer-events-none'
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {currentFile ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <File className="w-12 h-12 text-blue-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-white truncate max-w-full">
                  {currentFile.name}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {currentFile.type} • {formatBytes(currentFile.size)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear?.();
                }}
                className="flex items-center gap-1 px-3 py-1.5 mt-2 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                <X className="w-3 h-3" />
                Remove
              </button>
            </div>
          ) : currentDirectory && currentDirectory.length > 0 ? (
            <div className="flex flex-col items-center gap-3 w-full">
              <Folder className="w-12 h-12 text-yellow-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">
                  {currentDirectory.length} files
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {formatBytes(currentDirectory.reduce((sum, f) => sum + f.size, 0))} total
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClear?.();
                }}
                className="flex items-center gap-1 px-3 py-1.5 mt-2 text-xs bg-gray-700 hover:bg-gray-600 rounded transition-colors"
              >
                <X className="w-3 h-3" />
                Remove
              </button>
            </div>
          ) : null}

          <p className="text-xs text-gray-500 mt-4">
            Drop new file/folder to replace
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer min-h-[200px]',
          isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 hover:border-gray-500 bg-gray-800/50',
          isLoading && 'opacity-50 pointer-events-none'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById(`file-input-${side}`)?.click()}
      >
        <Upload className="w-10 h-10 text-gray-400 mb-3" />
        <p className="text-sm text-gray-300 text-center">
          {isLoading ? 'Loading...' : 'Drop file or folder here, or click to select'}
        </p>
        <p className="text-xs text-gray-500 mt-1 text-center">
          Drop 2 files/folders here to compare both at once
        </p>
        <input
          id={`file-input-${side}`}
          type="file"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* Directory selection button */}
      <button
        type="button"
        className="flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
        onClick={() => document.getElementById(`dir-input-${side}`)?.click()}
        disabled={isLoading}
      >
        <FolderOpen className="w-4 h-4" />
        Select Folder
      </button>
      <input
        id={`dir-input-${side}`}
        type="file"
        className="hidden"
        // @ts-ignore - webkitdirectory is not in the types
        webkitdirectory=""
        directory=""
        multiple
        onChange={handleFileSelect}
      />

      {/* URL input */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="url"
            placeholder="Enter file URL..."
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleUrlFetch()}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            disabled={isLoading}
          />
        </div>
        <button
          type="button"
          onClick={handleUrlFetch}
          disabled={!url.trim() || isLoading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-sm transition-colors"
        >
          Fetch
        </button>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}
    </div>
  );
}

// Helper functions
function getFileFromEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null)
    );
  });
}

async function processDirectoryEntry(
  entry: FileSystemDirectoryEntry,
  basePath: string
): Promise<FileData[]> {
  const files: FileData[] = [];
  const reader = entry.createReader();

  const readAllEntries = (): Promise<FileSystemEntry[]> => {
    return new Promise((resolve) => {
      const allEntries: FileSystemEntry[] = [];

      const readBatch = () => {
        reader.readEntries(async (entries) => {
          if (entries.length === 0) {
            resolve(allEntries);
          } else {
            allEntries.push(...entries);
            readBatch();
          }
        });
      };

      readBatch();
    });
  };

  const entries = await readAllEntries();

  for (const childEntry of entries) {
    if (childEntry.isFile) {
      const file = await getFileFromEntry(childEntry as FileSystemFileEntry);
      if (file) {
        const fileData = await processFile(file, basePath);
        files.push(fileData);
      }
    } else if (childEntry.isDirectory) {
      const subFiles = await processDirectoryEntry(
        childEntry as FileSystemDirectoryEntry,
        `${basePath}/${childEntry.name}`
      );
      files.push(...subFiles);
    }
  }

  return files;
}
