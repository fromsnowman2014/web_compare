import { diffLines, diffChars, diffWords } from 'diff';
import type { DiffLine, DiffResult, DiffStats, CharDiff, HexDiffLine } from '@/types';

export function computeTextDiff(leftText: string, rightText: string): DiffResult {
  const leftLines = leftText.split('\n');
  const rightLines = rightText.split('\n');

  const lineDiffs = diffLines(leftText, rightText);

  const diffLines2: DiffLine[] = [];
  let leftLineNum = 1;
  let rightLineNum = 1;

  let stats: DiffStats = {
    totalLines: 0,
    addedLines: 0,
    removedLines: 0,
    modifiedLines: 0,
    unchangedLines: 0,
  };

  let i = 0;
  while (i < lineDiffs.length) {
    const current = lineDiffs[i];
    const currentLines = current.value.replace(/\n$/, '').split('\n');

    if (!current.added && !current.removed) {
      // Unchanged lines
      for (const line of currentLines) {
        diffLines2.push({
          lineNumber: { left: leftLineNum++, right: rightLineNum++ },
          content: { left: line, right: line },
          type: 'unchanged',
        });
        stats.unchangedLines++;
        stats.totalLines++;
      }
    } else if (current.removed && lineDiffs[i + 1]?.added) {
      // Potential modification: removed followed by added
      const next = lineDiffs[i + 1];
      const removedLines = currentLines;
      const addedLines = next.value.replace(/\n$/, '').split('\n');

      const maxLen = Math.max(removedLines.length, addedLines.length);

      for (let j = 0; j < maxLen; j++) {
        const leftLine = removedLines[j] ?? '';
        const rightLine = addedLines[j] ?? '';

        if (j < removedLines.length && j < addedLines.length) {
          // Modified line - compute char-level diff
          const charDiffs = computeCharDiff(leftLine, rightLine);
          diffLines2.push({
            lineNumber: { left: leftLineNum++, right: rightLineNum++ },
            content: { left: leftLine, right: rightLine },
            type: 'modified',
            charDiffs,
          });
          stats.modifiedLines++;
        } else if (j < removedLines.length) {
          // Only removed
          diffLines2.push({
            lineNumber: { left: leftLineNum++, right: null },
            content: { left: leftLine, right: '' },
            type: 'removed',
          });
          stats.removedLines++;
        } else {
          // Only added
          diffLines2.push({
            lineNumber: { left: null, right: rightLineNum++ },
            content: { left: '', right: rightLine },
            type: 'added',
          });
          stats.addedLines++;
        }
        stats.totalLines++;
      }
      i++; // Skip the next (added) diff
    } else if (current.removed) {
      // Pure removal
      for (const line of currentLines) {
        diffLines2.push({
          lineNumber: { left: leftLineNum++, right: null },
          content: { left: line, right: '' },
          type: 'removed',
        });
        stats.removedLines++;
        stats.totalLines++;
      }
    } else if (current.added) {
      // Pure addition
      for (const line of currentLines) {
        diffLines2.push({
          lineNumber: { left: null, right: rightLineNum++ },
          content: { left: '', right: line },
          type: 'added',
        });
        stats.addedLines++;
        stats.totalLines++;
      }
    }
    i++;
  }

  return {
    lines: diffLines2,
    stats,
    isBinary: false,
  };
}

export function computeCharDiff(leftLine: string, rightLine: string): CharDiff[] {
  const charDiffs: CharDiff[] = [];
  const diffs = diffWords(leftLine, rightLine);

  for (const diff of diffs) {
    if (diff.added) {
      charDiffs.push({
        type: 'added',
        value: diff.value,
        side: 'right',
      });
    } else if (diff.removed) {
      charDiffs.push({
        type: 'removed',
        value: diff.value,
        side: 'left',
      });
    } else {
      charDiffs.push({
        type: 'unchanged',
        value: diff.value,
        side: 'left',
      });
      charDiffs.push({
        type: 'unchanged',
        value: diff.value,
        side: 'right',
      });
    }
  }

  return charDiffs;
}

export function computeHexDiff(
  leftBuffer: ArrayBuffer,
  rightBuffer: ArrayBuffer,
  bytesPerLine: number = 16
): HexDiffLine[] {
  const leftBytes = new Uint8Array(leftBuffer);
  const rightBytes = new Uint8Array(rightBuffer);

  const maxLength = Math.max(leftBytes.length, rightBytes.length);
  const lineCount = Math.ceil(maxLength / bytesPerLine);

  const hexLines: HexDiffLine[] = [];

  for (let i = 0; i < lineCount; i++) {
    const offset = i * bytesPerLine;
    const leftSlice = leftBytes.slice(offset, offset + bytesPerLine);
    const rightSlice = rightBytes.slice(offset, offset + bytesPerLine);

    const diffPositions: number[] = [];
    let hasDiff = false;

    for (let j = 0; j < bytesPerLine; j++) {
      const leftByte = j < leftSlice.length ? leftSlice[j] : undefined;
      const rightByte = j < rightSlice.length ? rightSlice[j] : undefined;

      if (leftByte !== rightByte) {
        hasDiff = true;
        diffPositions.push(j);
      }
    }

    hexLines.push({
      offset,
      left: {
        hex: Array.from(leftSlice).map((b) => b.toString(16).padStart(2, '0').toUpperCase()),
        ascii: Array.from(leftSlice)
          .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
          .join(''),
        bytes: Array.from(leftSlice),
      },
      right: {
        hex: Array.from(rightSlice).map((b) => b.toString(16).padStart(2, '0').toUpperCase()),
        ascii: Array.from(rightSlice)
          .map((b) => (b >= 32 && b <= 126 ? String.fromCharCode(b) : '.'))
          .join(''),
        bytes: Array.from(rightSlice),
      },
      hasDiff,
      diffPositions,
    });
  }

  return hexLines;
}

export function isBinaryContent(content: string | ArrayBuffer): boolean {
  if (content instanceof ArrayBuffer) {
    const bytes = new Uint8Array(content);
    const sampleSize = Math.min(bytes.length, 8192);
    let nullCount = 0;

    for (let i = 0; i < sampleSize; i++) {
      if (bytes[i] === 0) nullCount++;
      // High ratio of null bytes suggests binary
      if (nullCount > sampleSize * 0.1) return true;
    }
    return false;
  }

  // Check for null bytes in string
  return content.includes('\0');
}

export function getDiffIndices(lines: DiffLine[]): number[] {
  return lines
    .map((line, index) => (line.type !== 'unchanged' ? index : -1))
    .filter((index) => index !== -1);
}

export function findNextDiffIndex(lines: DiffLine[], currentIndex: number): number {
  const indices = getDiffIndices(lines);
  const next = indices.find((i) => i > currentIndex);
  return next !== undefined ? next : indices[0] ?? currentIndex;
}

export function findPrevDiffIndex(lines: DiffLine[], currentIndex: number): number {
  const indices = getDiffIndices(lines);
  const prev = [...indices].reverse().find((i) => i < currentIndex);
  return prev !== undefined ? prev : indices[indices.length - 1] ?? currentIndex;
}
