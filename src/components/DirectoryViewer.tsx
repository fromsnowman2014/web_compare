'use client';

import { useState, useCallback, useMemo } from 'react';
import {
  Folder,
  FolderOpen,
  File,
  FilePlus,
  FileMinus,
  FileEdit,
  FileCheck,
  ChevronRight,
  ChevronDown,
  Download,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBytes } from '@/lib/utils';
import type { DirectoryDiffItem, FileData } from '@/types';
import { compareDirectories, downloadFile } from '@/lib/file';
import JSZip from 'jszip';

interface DirectoryViewerProps {
  leftFiles: FileData[];
  rightFiles: FileData[];
  onFileSelect?: (leftFile: FileData | undefined, rightFile: FileData | undefined) => void;
}

export function DirectoryViewer({
  leftFiles,
  rightFiles,
  onFileSelect,
}: DirectoryViewerProps) {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'changed' | 'added' | 'removed'>('all');

  const diffItems = useMemo(
    () => compareDirectories(leftFiles, rightFiles),
    [leftFiles, rightFiles]
  );

  const filteredItems = useMemo(() => {
    if (filter === 'all') return diffItems;
    return diffItems.filter((item) => {
      if (filter === 'changed') return item.status !== 'unchanged';
      if (filter === 'added') return item.status === 'added';
      if (filter === 'removed') return item.status === 'removed';
      return true;
    });
  }, [diffItems, filter]);

  const stats = useMemo(() => {
    return {
      total: diffItems.length,
      unchanged: diffItems.filter((i) => i.status === 'unchanged').length,
      added: diffItems.filter((i) => i.status === 'added').length,
      removed: diffItems.filter((i) => i.status === 'removed').length,
      modified: diffItems.filter((i) => i.status === 'modified').length,
    };
  }, [diffItems]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const handleSelect = useCallback(
    (item: DirectoryDiffItem) => {
      setSelectedPath(item.path);
      if (item.type === 'file') {
        onFileSelect?.(item.leftFile, item.rightFile);
      }
    },
    [onFileSelect]
  );

  const handleDownloadMerged = useCallback(async () => {
    const zip = new JSZip();

    // Add all files from both sides, preferring right side for conflicts
    const allFiles = new Map<string, FileData>();

    for (const file of leftFiles) {
      allFiles.set(file.path, file);
    }

    for (const file of rightFiles) {
      allFiles.set(file.path, file);
    }

    for (const [path, file] of allFiles) {
      if (file.type !== 'directory') {
        const content =
          file.content instanceof ArrayBuffer
            ? file.content
            : new TextEncoder().encode(file.content as string);
        zip.file(path, content);
      }
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'merged-files.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [leftFiles, rightFiles]);

  const getStatusIcon = (status: DirectoryDiffItem['status']) => {
    switch (status) {
      case 'added':
        return <FilePlus className="w-4 h-4 text-green-400" />;
      case 'removed':
        return <FileMinus className="w-4 h-4 text-red-400" />;
      case 'modified':
        return <FileEdit className="w-4 h-4 text-yellow-400" />;
      case 'unchanged':
        return <FileCheck className="w-4 h-4 text-gray-500" />;
      default:
        return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: DirectoryDiffItem['status']) => {
    switch (status) {
      case 'added':
        return 'text-green-400';
      case 'removed':
        return 'text-red-400';
      case 'modified':
        return 'text-yellow-400';
      default:
        return 'text-gray-300';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            Total: <span className="text-white">{stats.total}</span>
          </span>
          <span className="text-sm text-green-400">+{stats.added} added</span>
          <span className="text-sm text-red-400">-{stats.removed} removed</span>
          <span className="text-sm text-yellow-400">~{stats.modified} modified</span>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
            className="px-3 py-1.5 text-sm bg-gray-700 border border-gray-600 rounded focus:outline-none focus:border-blue-500"
          >
            <option value="all">All files</option>
            <option value="changed">Changed only</option>
            <option value="added">Added only</option>
            <option value="removed">Removed only</option>
          </select>

          <button
            onClick={handleDownloadMerged}
            className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 rounded transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Merged
          </button>
        </div>
      </div>

      {/* File tree */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Left side - File names */}
          <div className="flex-1 border-r border-gray-700">
            <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-sm text-gray-400 font-medium">
              Left ({leftFiles.length} files)
            </div>
            <div className="p-2">
              {filteredItems.map((item) => (
                <DirectoryItem
                  key={item.path}
                  item={item}
                  side="left"
                  isExpanded={expandedPaths.has(item.path)}
                  isSelected={selectedPath === item.path}
                  onToggle={() => toggleExpand(item.path)}
                  onSelect={() => handleSelect(item)}
                  getStatusIcon={getStatusIcon}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          </div>

          {/* Right side - File names */}
          <div className="flex-1">
            <div className="px-3 py-1.5 bg-gray-800 border-b border-gray-700 text-sm text-gray-400 font-medium">
              Right ({rightFiles.length} files)
            </div>
            <div className="p-2">
              {filteredItems.map((item) => (
                <DirectoryItem
                  key={item.path}
                  item={item}
                  side="right"
                  isExpanded={expandedPaths.has(item.path)}
                  isSelected={selectedPath === item.path}
                  onToggle={() => toggleExpand(item.path)}
                  onSelect={() => handleSelect(item)}
                  getStatusIcon={getStatusIcon}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface DirectoryItemProps {
  item: DirectoryDiffItem;
  side: 'left' | 'right';
  isExpanded: boolean;
  isSelected: boolean;
  onToggle: () => void;
  onSelect: () => void;
  getStatusIcon: (status: DirectoryDiffItem['status']) => React.ReactNode;
  getStatusColor: (status: DirectoryDiffItem['status']) => string;
}

function DirectoryItem({
  item,
  side,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  getStatusIcon,
  getStatusColor,
}: DirectoryItemProps) {
  const file = side === 'left' ? item.leftFile : item.rightFile;
  const depth = item.path.split('/').filter(Boolean).length - 1;

  const isVisible =
    side === 'left' ? item.status !== 'added' : item.status !== 'removed';

  if (!isVisible) {
    return (
      <div
        className="flex items-center gap-2 py-1 px-2 text-gray-600 cursor-default"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <span className="w-4" />
        <File className="w-4 h-4" />
        <span className="text-sm italic">—</span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 py-1 px-2 rounded cursor-pointer transition-colors',
        isSelected ? 'bg-blue-900/50' : 'hover:bg-gray-700/50'
      )}
      style={{ paddingLeft: `${depth * 16 + 8}px` }}
      onClick={onSelect}
    >
      {item.type === 'directory' ? (
        <button onClick={(e) => { e.stopPropagation(); onToggle(); }} className="p-0.5">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-400" />
          )}
        </button>
      ) : (
        <span className="w-4" />
      )}

      {item.type === 'directory' ? (
        isExpanded ? (
          <FolderOpen className="w-4 h-4 text-yellow-400" />
        ) : (
          <Folder className="w-4 h-4 text-yellow-400" />
        )
      ) : (
        getStatusIcon(item.status)
      )}

      <span className={cn('text-sm truncate', getStatusColor(item.status))}>
        {item.name}
      </span>

      {file && (
        <span className="text-xs text-gray-500 ml-auto">
          {formatBytes(file.size)}
        </span>
      )}
    </div>
  );
}
