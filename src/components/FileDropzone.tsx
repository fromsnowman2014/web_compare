'use client';

import { useCallback, useState } from 'react';
import { Upload, Link, FolderOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FileData } from '@/types';
import { processFile, fetchFileFromUrl, processDirectory } from '@/lib/file';

interface FileDropzoneProps {
  side: 'left' | 'right';
  onFileLoaded: (file: FileData) => void;
  onDirectoryLoaded?: (files: FileData[]) => void;
  className?: string;
}

export function FileDropzone({
  side,
  onFileLoaded,
  onDirectoryLoaded,
  className,
}: FileDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

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

        // Check if it's a directory
        for (let i = 0; i < items.length; i++) {
          const entry = items[i].webkitGetAsEntry();
          if (entry) {
            entries.push(entry);
          }
        }

        if (entries.length === 1 && entries[0].isDirectory) {
          // Directory drop
          const files = await processDirectory(entries, '');
          onDirectoryLoaded?.(files);
        } else {
          // Single file drop
          const file = e.dataTransfer.files[0];
          if (file) {
            const fileData = await processFile(file);
            onFileLoaded(fileData);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process file');
      } finally {
        setIsLoading(false);
      }
    },
    [onFileLoaded, onDirectoryLoaded]
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

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div
        className={cn(
          'flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg transition-colors cursor-pointer',
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
        <p className="text-xs text-gray-500 mt-1">
          Supports text, code, binary files, and directories
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
