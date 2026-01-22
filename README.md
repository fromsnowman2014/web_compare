# Web Compare

A powerful web-based file comparison tool similar to Beyond Compare. Compare text, code, binary files, and directories directly in your browser.

## Features

### File Comparison
- **Text/Code Comparison**: Side-by-side diff view with syntax highlighting
- **Line-by-line diff**: See exactly what changed between files
- **Character-level diff**: Highlight specific character changes within modified lines
- **Binary Comparison**: Hex view with byte-level difference highlighting
- **Directory Comparison**: Compare entire folder structures

### Input Methods
- **Drag & Drop**: Simply drag files or folders onto the upload area
- **File Selection**: Click to browse and select files
- **Directory Upload**: Select entire folders for comparison
- **URL Fetch**: Load files directly from URLs

### Navigation & Editing
- **F7 Navigation**: Press F7 to jump to next difference, Shift+F7 for previous
- **Synchronized Scrolling**: Both sides scroll together for easy comparison
- **Edit Mode**: Modify files directly in the editor
- **Merge Support**: Copy changes from left to right or vice versa
- **Download**: Export modified files

### Supported File Types
- Text files (.txt, .md, .json, .xml, etc.)
- Source code (JavaScript, TypeScript, Python, Java, Go, Rust, etc.)
- Binary files (with hex view)
- Images (comparison view)

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
| F7 | Go to next difference |
| Shift + F7 | Go to previous difference |
| Ctrl + S | Download file (in edit mode) |
| Ctrl + Z | Undo (in edit mode) |
| Ctrl + Shift + Z | Redo (in edit mode) |

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **UI**: React + Tailwind CSS
- **Editor**: Monaco Editor (VS Code engine)
- **Diff Algorithm**: diff + diff-match-patch
- **State Management**: Zustand
- **File Handling**: JSZip for directory export

## License

MIT
