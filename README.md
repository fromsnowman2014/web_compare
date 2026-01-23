# Web Compare

A powerful web-based file comparison tool inspired by Beyond Compare. Compare text, code, binary files, and directories directly in your browser with inline merge actions.

## Features

### File Comparison
- **Side-by-side Diff View**: Custom diff viewer with left/right panels and center action gutter
- **Line-by-line Diff**: See exactly what changed between files with color-coded highlighting
- **Character-level Diff**: Highlight specific word/character changes within modified lines
- **Binary Comparison**: Hex view with byte-level difference highlighting
- **Directory Comparison**: Compare entire folder structures with status indicators

### Merge Actions (Beyond Compare Style)
- **Center Gutter Buttons**: Action buttons appear between diff panels for each change block
- **Copy to Left (←)**: Copy content from right side to left (for added/modified blocks)
- **Copy to Right (→)**: Copy content from left side to right (for removed/modified blocks)
- **Delete from Left**: Remove content from left side (for removed/modified blocks)
- **Delete from Right**: Remove content from right side (for added/modified blocks)
- **Real-time Updates**: Changes are immediately reflected in the diff view

### Input Methods
- **Drag & Drop**: Drag files or folders onto the upload area
- **Multi-file Drop**: Drop 2 files at once - automatically sorted by modification time (older=left, newer=right)
- **File Selection**: Click to browse and select files
- **Directory Upload**: Select entire folders for comparison
- **URL Fetch**: Load files directly from URLs

### Navigation & View Options
- **Block Navigation**: Navigate between diff sections (Section X / Y indicator)
- **F7 Navigation**: Press F7 to jump to next difference, Shift+F7 for previous
- **Synchronized Scrolling**: Both sides scroll together (toggleable)
- **All Text / Diffs Only**: Toggle between viewing all content or only differences with context
- **Path Bar**: Shows file name, type, size, and modification date for each side
- **Diff Statistics**: Shows total lines, added, removed, modified, and unchanged counts

### Download & Export
- **Download Left/Right**: Export individual files after modifications
- **Download Merged (Directory)**: Export merged directory contents as ZIP

### Supported File Types
- Text files (.txt, .md, .json, .xml, .yaml, .toml, etc.)
- Source code (JavaScript, TypeScript, Python, Java, Go, Rust, C/C++, etc.)
- Binary files (with hex view)
- Images (binary comparison)

## User Interface

### Upload View
1. Two drop zones for left (original) and right (modified) files
2. Support for files, directories, and URLs
3. "Compare Files" button activates when both sides have content

### Compare View
- **Header**: View mode tabs (Text/Binary/Directory), navigation controls
- **Path Bar**: File information for both sides
- **Toolbar**: Block navigation, view toggle, sync scroll, download buttons
- **Diff Stats Bar**: Line statistics
- **Main Area**: Three-column layout
  - Left panel: Original content with line numbers
  - Center gutter: Action buttons (copy/delete) for each diff block
  - Right panel: Modified content with line numbers

### Color Coding
| Color | Meaning |
|-------|---------|
| Green background | Added lines (right side only) |
| Red background | Removed lines (left side only) |
| Yellow background | Modified lines (both sides) |
| Green highlight | Added characters within modified lines |
| Red highlight | Removed characters within modified lines |

### Gutter Button Colors
| Button | Color | Action |
|--------|-------|--------|
| ← | Blue | Copy to left |
| → | Green | Copy to right |
| 🗑 (left) | Dark red | Delete from left |
| 🗑 (right) | Light red | Delete from right |

## Getting Started

### Prerequisites
- Node.js 18.x or higher
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd web_compare

# Install dependencies
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
# Build for production
npm run build

# Start production server
npm start
```

## Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Deploy with default settings

### Self-hosted (Linux Server)

```bash
# Build the application
npm run build

# Start with PM2 (recommended)
npm install -g pm2
pm2 start npm --name "web-compare" -- start

# Or use the standalone build
node .next/standalone/server.js
```

#### Docker Deployment

```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
```

```bash
docker build -t web-compare .
docker run -p 3000:3000 web-compare
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| F7 | Go to next difference block |
| Shift + F7 | Go to previous difference block |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: React 18 + Tailwind CSS
- **Icons**: Lucide React
- **Diff Algorithm**: diff library
- **State Management**: Zustand
- **File Handling**: JSZip for directory export

## Project Structure

```
src/
├── app/
│   ├── api/fetch/      # URL fetch API route
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # App layout
│   └── page.tsx        # Main page (upload/compare flow)
├── components/
│   ├── EnhancedDiffViewer.tsx  # Main diff viewer with merge actions
│   ├── HexViewer.tsx           # Binary file comparison
│   ├── DirectoryViewer.tsx     # Directory comparison
│   └── FileDropzone.tsx        # File upload component
├── lib/
│   ├── diff.ts         # Diff computation functions
│   ├── file.ts         # File processing utilities
│   └── utils.ts        # General utilities
├── store/
│   └── compare.ts      # Zustand store
└── types/
    └── index.ts        # TypeScript interfaces
```

## License

MIT
