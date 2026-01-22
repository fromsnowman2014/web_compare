import type { FileData, FileType, DirectoryDiffItem } from '@/types';

export function detectFileType(file: File): FileType {
  const name = file.name.toLowerCase();
  const mimeType = file.type;

  // Image files
  if (mimeType.startsWith('image/')) {
    return 'image';
  }

  // Binary file extensions
  const binaryExtensions = [
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat',
    '.zip', '.tar', '.gz', '.7z', '.rar',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.mp3', '.mp4', '.avi', '.mov', '.wav',
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.ttf', '.otf', '.woff', '.woff2',
    '.class', '.pyc', '.o', '.obj',
  ];

  if (binaryExtensions.some((ext) => name.endsWith(ext))) {
    return 'binary';
  }

  // Text file extensions
  const textExtensions = [
    '.txt', '.md', '.json', '.xml', '.html', '.htm', '.css',
    '.js', '.ts', '.jsx', '.tsx', '.vue', '.svelte',
    '.py', '.rb', '.php', '.java', '.c', '.cpp', '.h', '.hpp',
    '.cs', '.go', '.rs', '.swift', '.kt', '.scala',
    '.sql', '.sh', '.bash', '.zsh', '.fish',
    '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf',
    '.gitignore', '.dockerignore', '.env',
    '.csv', '.log', '.rst', '.tex',
  ];

  if (textExtensions.some((ext) => name.endsWith(ext))) {
    return 'text';
  }

  // Check MIME type for text
  if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    return 'text';
  }

  // Default to binary for unknown types
  return 'binary';
}

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  const languageMap: Record<string, string> = {
    js: 'javascript',
    jsx: 'javascript',
    ts: 'typescript',
    tsx: 'typescript',
    py: 'python',
    rb: 'ruby',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'cpp',
    hpp: 'cpp',
    cs: 'csharp',
    go: 'go',
    rs: 'rust',
    swift: 'swift',
    kt: 'kotlin',
    scala: 'scala',
    php: 'php',
    html: 'html',
    htm: 'html',
    css: 'css',
    scss: 'scss',
    sass: 'scss',
    less: 'less',
    json: 'json',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'toml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    dockerfile: 'dockerfile',
    makefile: 'makefile',
    vue: 'vue',
    svelte: 'svelte',
  };

  return languageMap[ext] || 'plaintext';
}

export async function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

export async function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

export async function processFile(file: File, basePath: string = ''): Promise<FileData> {
  const fileType = detectFileType(file);
  const path = basePath ? `${basePath}/${file.name}` : file.name;

  let content: string | ArrayBuffer;

  if (fileType === 'binary' || fileType === 'image') {
    content = await readFileAsArrayBuffer(file);
  } else {
    content = await readFileAsText(file);
  }

  return {
    name: file.name,
    path,
    content,
    type: fileType,
    size: file.size,
    lastModified: file.lastModified,
  };
}

export async function processDirectory(
  items: FileSystemEntry[],
  basePath: string = ''
): Promise<FileData[]> {
  const files: FileData[] = [];

  for (const item of items) {
    if (item.isFile) {
      const file = await getFileFromEntry(item as FileSystemFileEntry);
      if (file) {
        const fileData = await processFile(file, basePath);
        files.push(fileData);
      }
    } else if (item.isDirectory) {
      const dirEntry = item as FileSystemDirectoryEntry;
      const dirFiles = await readDirectoryEntry(dirEntry, `${basePath}/${item.name}`);
      files.push(...dirFiles);
    }
  }

  return files;
}

function getFileFromEntry(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => {
    entry.file(
      (file) => resolve(file),
      () => resolve(null)
    );
  });
}

function readDirectoryEntry(entry: FileSystemDirectoryEntry, path: string): Promise<FileData[]> {
  return new Promise((resolve) => {
    const reader = entry.createReader();
    const files: FileData[] = [];

    const readEntries = () => {
      reader.readEntries(async (entries) => {
        if (entries.length === 0) {
          resolve(files);
          return;
        }

        for (const entry of entries) {
          if (entry.isFile) {
            const file = await getFileFromEntry(entry as FileSystemFileEntry);
            if (file) {
              const fileData = await processFile(file, path);
              files.push(fileData);
            }
          } else if (entry.isDirectory) {
            const dirFiles = await readDirectoryEntry(
              entry as FileSystemDirectoryEntry,
              `${path}/${entry.name}`
            );
            files.push(...dirFiles);
          }
        }

        readEntries(); // Continue reading
      });
    };

    readEntries();
  });
}

export async function fetchFileFromUrl(url: string): Promise<FileData> {
  // Use API route to bypass CORS
  const response = await fetch('/api/fetch', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || `Failed to fetch file: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type') || '';
  const filename = response.headers.get('x-filename') || url.split('/').pop() || 'downloaded-file';

  const isBinary =
    contentType.includes('application/octet-stream') ||
    contentType.includes('image/') ||
    contentType.includes('application/pdf');

  let content: string | ArrayBuffer;
  let type: FileType;

  if (isBinary || contentType.startsWith('image/')) {
    content = await response.arrayBuffer();
    type = contentType.startsWith('image/') ? 'image' : 'binary';
  } else {
    content = await response.text();
    type = 'text';
  }

  return {
    name: filename,
    path: filename,
    content,
    type,
    size: typeof content === 'string' ? content.length : content.byteLength,
  };
}

export function buildDirectoryTree(files: FileData[]): FileData {
  const root: FileData = {
    name: 'root',
    path: '',
    content: '',
    type: 'directory',
    size: 0,
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split('/').filter(Boolean);
    let current = root;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      let child = current.children?.find((c) => c.name === part && c.type === 'directory');

      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join('/'),
          content: '',
          type: 'directory',
          size: 0,
          children: [],
        };
        current.children?.push(child);
      }

      current = child;
    }

    current.children?.push(file);
  }

  return root;
}

export function compareDirectories(
  leftFiles: FileData[],
  rightFiles: FileData[]
): DirectoryDiffItem[] {
  const leftMap = new Map<string, FileData>();
  const rightMap = new Map<string, FileData>();

  for (const file of leftFiles) {
    leftMap.set(file.path, file);
  }

  for (const file of rightFiles) {
    rightMap.set(file.path, file);
  }

  const allPaths = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const items: DirectoryDiffItem[] = [];

  for (const path of allPaths) {
    const leftFile = leftMap.get(path);
    const rightFile = rightMap.get(path);

    let status: DirectoryDiffItem['status'];

    if (leftFile && !rightFile) {
      status = 'removed';
    } else if (!leftFile && rightFile) {
      status = 'added';
    } else if (leftFile && rightFile) {
      if (leftFile.content === rightFile.content) {
        status = 'unchanged';
      } else {
        status = 'modified';
      }
    } else {
      continue;
    }

    items.push({
      name: path.split('/').pop() || path,
      path,
      type: leftFile?.type === 'directory' || rightFile?.type === 'directory' ? 'directory' : 'file',
      status,
      leftFile,
      rightFile,
    });
  }

  // Sort: directories first, then by name
  items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.path.localeCompare(b.path);
  });

  return items;
}

export function downloadFile(content: string | ArrayBuffer, filename: string): void {
  const blob =
    typeof content === 'string'
      ? new Blob([content], { type: 'text/plain;charset=utf-8' })
      : new Blob([content], { type: 'application/octet-stream' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
