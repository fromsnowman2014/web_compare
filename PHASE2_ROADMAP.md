# Phase 2 Roadmap: Beyond Compare-Level File Comparison Tool

## Current State Summary

The app has a solid foundation with:
- Side-by-side text diff with character-level highlighting
- Edit mode for direct text manipulation
- Copy/Delete block operations
- Binary hex viewer
- Directory comparison with ZIP export
- Synchronized scrolling and F7 navigation

---

## Phase 2 Improvements

### P0: Stability & Corner Cases (Critical)

#### 1. Performance Optimization
**Problem**: Large files (>5000 lines) cause UI lag due to full re-render on every change.

| Task | Description | Effort |
|------|-------------|--------|
| Virtual Scrolling | Only render visible lines using `react-window` or custom implementation | Medium |
| Diff Debouncing | Debounce diff computation in edit mode (300ms delay) | Small |
| Web Workers | Move diff computation to background thread | Medium |
| Memoization | Cache diff results based on content hash | Small |

#### 2. Encoding & Line Endings
**Problem**: Different encodings and line endings cause false positives.

| Task | Description | Effort |
|------|-------------|--------|
| Encoding Detection | Auto-detect UTF-8, UTF-16, ISO-8859-1, etc. using `jschardet` | Small |
| Line Ending Normalization | Option to ignore CRLF vs LF differences | Small |
| Encoding Selector | UI dropdown to force specific encoding | Small |
| BOM Handling | Detect and handle byte order marks | Small |

#### 3. Error Handling & Edge Cases
| Task | Description | Effort |
|------|-------------|--------|
| Error Boundaries | React error boundaries for graceful failure recovery | Small |
| Empty File Handling | Proper UI for comparing empty files | Small |
| Large File Warning | Warn before loading files >50MB | Small |
| Memory Management | Cleanup references on file change to prevent leaks | Small |
| Max Recursion Depth | Limit directory traversal depth (default: 10 levels) | Small |

---

### P1: Core UX Improvements (High Priority)

#### 4. Undo/Redo System
**Problem**: No way to revert accidental edits or merges.

```
Implementation Plan:
1. Create history stack in Zustand store
2. Track all editedContent changes
3. Implement Ctrl+Z (undo) and Ctrl+Y/Ctrl+Shift+Z (redo)
4. Show undo/redo buttons in toolbar
5. Limit history to last 50 operations
```

| Task | Description | Effort |
|------|-------------|--------|
| History Store | Add undo/redo stack to Zustand | Medium |
| Keyboard Shortcuts | Ctrl+Z, Ctrl+Y integration | Small |
| UI Buttons | Undo/Redo buttons in toolbar | Small |
| Merge Tracking | Track copy/delete operations separately | Medium |

#### 5. Search & Find
**Problem**: Can't search for text within the comparison view.

| Task | Description | Effort |
|------|-------------|--------|
| Ctrl+F Search | Open search bar, highlight matches | Medium |
| Find Next/Previous | F3 / Shift+F3 navigation | Small |
| Search in Both Panels | Option to search left, right, or both | Small |
| Regex Support | Optional regex search mode | Medium |
| Find & Replace (Edit Mode) | Replace functionality when in edit mode | Medium |

#### 6. Syntax Highlighting
**Problem**: Code files are plain monospace text, hard to read.

| Task | Description | Effort |
|------|-------------|--------|
| Highlight.js Integration | Add syntax highlighting library | Medium |
| Language Auto-Detection | Detect from file extension | Small |
| Language Selector | Manual override dropdown | Small |
| Theme Support | Match highlight theme with diff colors | Medium |

#### 7. Improved Keyboard Navigation
| Task | Description | Effort |
|------|-------------|--------|
| Go to Line (Ctrl+G) | Jump to specific line number | Small |
| Tab Navigation | Tab through gutter buttons | Small |
| Escape to Close | Close dialogs/search with Escape | Small |
| Keyboard Shortcuts Help | Show all shortcuts in modal (?) | Small |

---

### P2: Advanced Features (Medium Priority)

#### 8. Three-Way Merge
**Problem**: Can't compare with a common ancestor (base version).

```
Use Case: Git merge conflicts
- Base (common ancestor)
- Left (your changes)
- Right (their changes)
```

| Task | Description | Effort |
|------|-------------|--------|
| Base File Input | Third file drop zone | Medium |
| Three-Way Diff Algorithm | Compare all three versions | Large |
| Conflict Detection | Identify overlapping changes | Medium |
| Conflict Resolution UI | Choose left, right, or both | Medium |

#### 9. Git Integration
| Task | Description | Effort |
|------|-------------|--------|
| Compare with HEAD | Load file from git HEAD | Medium |
| Branch Comparison | Select branches to compare | Medium |
| Commit History | Show file at specific commit | Medium |
| Staged vs Unstaged | Compare staging area | Small |

#### 10. Session Persistence
**Problem**: Losing all work on page refresh.

| Task | Description | Effort |
|------|-------------|--------|
| IndexedDB Storage | Persist files and state locally | Medium |
| Session Recovery | "Restore previous session?" prompt | Small |
| Recent Files List | Quick access to recently compared files | Medium |
| Export Session | Save comparison as JSON for later | Small |

#### 11. Ignore Options
| Task | Description | Effort |
|------|-------------|--------|
| Ignore Whitespace | Toggle to ignore space differences | Small |
| Ignore Case | Case-insensitive comparison | Small |
| Ignore Blank Lines | Skip empty line differences | Small |
| Ignore Comments | Skip comment lines (language-aware) | Medium |
| Custom Ignore Patterns | Regex patterns to ignore | Medium |

#### 12. Enhanced Directory Comparison
| Task | Description | Effort |
|------|-------------|--------|
| Expand/Collapse Folders | Tree view with collapsible nodes | Medium |
| File Content Preview | Quick preview on hover/click | Medium |
| Bulk Operations | Copy all left→right, sync folders | Medium |
| Filter by Extension | Show only *.js, *.ts, etc. | Small |
| Ignore Patterns | .gitignore-style exclusions | Medium |

---

### P3: Nice-to-Have Features (Lower Priority)

#### 13. UI/UX Enhancements
| Task | Description | Effort |
|------|-------------|--------|
| Dark/Light Theme Toggle | User preference for theme | Medium |
| Custom Colors | Configure diff highlight colors | Medium |
| Resizable Panels | Drag to resize left/right panels | Medium |
| Minimap | VS Code-style overview bar | Large |
| Line Wrapping Toggle | Soft wrap long lines | Small |
| Font Size Control | Zoom in/out for readability | Small |

#### 14. Export Options
| Task | Description | Effort |
|------|-------------|--------|
| Unified Diff Export | Standard .diff/.patch format | Medium |
| Side-by-Side HTML | Exportable HTML report | Medium |
| JSON Export | Machine-readable diff data | Small |
| PDF Report | Printable comparison report | Large |

#### 15. Clipboard Integration
| Task | Description | Effort |
|------|-------------|--------|
| Paste from Clipboard | Ctrl+V to paste text directly | Small |
| Copy Diff Summary | Copy stats to clipboard | Small |
| Copy Block | Copy individual diff blocks | Small |

#### 16. Mobile Support
| Task | Description | Effort |
|------|-------------|--------|
| Responsive Layout | Stacked view on small screens | Medium |
| Touch Gestures | Swipe to navigate diffs | Medium |
| Mobile-Friendly Buttons | Larger touch targets | Small |

#### 17. Collaboration Features (Future)
| Task | Description | Effort |
|------|-------------|--------|
| Share Link | Generate shareable comparison URL | Large |
| Real-time Collaboration | Multiple users editing | Very Large |
| Comments | Add notes to specific lines | Large |

---

## Recommended Implementation Order

### Sprint 1: Stability Foundation
1. Error Boundaries
2. Empty File Handling
3. Large File Warning
4. Diff Debouncing in Edit Mode
5. Line Ending Normalization Option

### Sprint 2: Core UX
1. Undo/Redo System
2. Ctrl+F Search
3. Go to Line (Ctrl+G)
4. Keyboard Shortcuts Help Modal

### Sprint 3: Performance
1. Virtual Scrolling for Large Files
2. Web Worker for Diff Computation
3. Diff Result Caching

### Sprint 4: Code Readability
1. Syntax Highlighting
2. Line Wrapping Toggle
3. Font Size Control

### Sprint 5: Ignore Options
1. Ignore Whitespace
2. Ignore Case
3. Ignore Blank Lines
4. Custom Ignore Patterns

### Sprint 6: Advanced Features
1. Three-Way Merge (Base)
2. Session Persistence
3. Recent Files List

### Sprint 7: Directory Improvements
1. Expand/Collapse Tree View
2. File Content Preview
3. Filter by Extension

### Sprint 8: Export & Polish
1. Unified Diff Export
2. Dark/Light Theme Toggle
3. Resizable Panels

---

## Technical Architecture Recommendations

### 1. Web Worker Architecture
```
Main Thread                 Worker Thread
    │                           │
    ├── Send content ──────────►│
    │                           ├── Compute diff
    │                           │
    │◄────── Return result ─────┤
    │                           │
    ├── Update UI               │
```

### 2. Virtual Scrolling Strategy
```tsx
// Use react-window for efficient rendering
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={containerHeight}
  itemCount={diffLines.length}
  itemSize={LINE_HEIGHT}
>
  {({ index, style }) => <DiffLine line={diffLines[index]} style={style} />}
</FixedSizeList>
```

### 3. Undo/Redo State Pattern
```typescript
interface HistoryState {
  past: EditState[];
  present: EditState;
  future: EditState[];
}

// Actions
const undo = () => {
  if (past.length === 0) return;
  const previous = past[past.length - 1];
  const newPast = past.slice(0, -1);
  set({ past: newPast, present: previous, future: [present, ...future] });
};
```

### 4. Search Highlight Strategy
```typescript
interface SearchState {
  query: string;
  isRegex: boolean;
  caseSensitive: boolean;
  matches: Array<{ lineIndex: number; charStart: number; charEnd: number }>;
  currentMatchIndex: number;
}
```

---

## Dependencies to Add

```json
{
  "dependencies": {
    "react-window": "^1.8.10",        // Virtual scrolling
    "highlight.js": "^11.9.0",         // Syntax highlighting
    "jschardet": "^3.0.0",             // Encoding detection
    "idb-keyval": "^6.2.1"             // Simple IndexedDB wrapper
  }
}
```

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Max file size without lag | ~5,000 lines | 100,000+ lines |
| Time to first diff | Instant for small | <500ms for 10k lines |
| Supported encodings | UTF-8 only | UTF-8, UTF-16, ISO-8859-1 |
| Keyboard shortcuts | 2 (F7, Shift+F7) | 15+ |
| Undo depth | 0 | 50 operations |

---

## Notes

- Each sprint is approximately 1-2 weeks of work
- P0 items should be completed before P1
- Features can be implemented incrementally
- User feedback should guide priority adjustments
- Consider A/B testing for major UX changes

---

*Last Updated: 2026-01-30*
