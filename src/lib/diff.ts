import { diffLines, diffWords } from 'diff';
import type { DiffLine, DiffResult, DiffStats, CharDiff, HexDiffLine, DiffBlock } from '@/types';

export function computeTextDiff(leftText: string, rightText: string): DiffResult {
  const lineDiffs = diffLines(leftText, rightText);
  const diffLines2: DiffLine[] = [];
  let leftLineNum = 1;
  let rightLineNum = 1;

  const stats: DiffStats = {
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
      const next = lineDiffs[i + 1];
      const removedLines = currentLines;
      const addedLines = next.value.replace(/\n$/, '').split('\n');
      const maxLen = Math.max(removedLines.length, addedLines.length);

      for (let j = 0; j < maxLen; j++) {
        const leftLine = removedLines[j] ?? '';
        const rightLine = addedLines[j] ?? '';

        if (j < removedLines.length && j < addedLines.length) {
          const charDiffs = computeCharDiff(leftLine, rightLine);
          diffLines2.push({
            lineNumber: { left: leftLineNum++, right: rightLineNum++ },
            content: { left: leftLine, right: rightLine },
            type: 'modified',
            charDiffs,
          });
          stats.modifiedLines++;
        } else if (j < removedLines.length) {
          diffLines2.push({
            lineNumber: { left: leftLineNum++, right: null },
            content: { left: leftLine, right: '' },
            type: 'removed',
          });
          stats.removedLines++;
        } else {
          diffLines2.push({
            lineNumber: { left: null, right: rightLineNum++ },
            content: { left: '', right: rightLine },
            type: 'added',
          });
          stats.addedLines++;
        }
        stats.totalLines++;
      }
      i++;
    } else if (current.removed) {
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

  const blocks = computeDiffBlocks(diffLines2);

  return {
    lines: diffLines2,
    blocks,
    stats,
    isBinary: false,
  };
}

function computeCharDiff(leftLine: string, rightLine: string): CharDiff[] {
  const charDiffs: CharDiff[] = [];
  const diffs = diffWords(leftLine, rightLine);

  for (const diff of diffs) {
    if (diff.added) {
      charDiffs.push({ type: 'added', value: diff.value, side: 'right' });
    } else if (diff.removed) {
      charDiffs.push({ type: 'removed', value: diff.value, side: 'left' });
    } else {
      charDiffs.push({ type: 'unchanged', value: diff.value, side: 'left' });
      charDiffs.push({ type: 'unchanged', value: diff.value, side: 'right' });
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

function computeDiffBlocks(lines: DiffLine[]): DiffBlock[] {
  if (lines.length === 0) return [];

  const blocks: DiffBlock[] = [];
  let currentBlock: DiffBlock | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const blockType = line.type === 'unchanged' ? 'unchanged' :
                      line.type === 'added' ? 'added' :
                      line.type === 'removed' ? 'removed' : 'modified';

    if (!currentBlock || currentBlock.type !== blockType) {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {
        startIndex: i,
        endIndex: i,
        type: blockType,
        leftLineStart: line.lineNumber.left,
        leftLineEnd: line.lineNumber.left,
        rightLineStart: line.lineNumber.right,
        rightLineEnd: line.lineNumber.right,
        lines: [line],
      };
    } else {
      currentBlock.endIndex = i;
      currentBlock.leftLineEnd = line.lineNumber.left ?? currentBlock.leftLineEnd;
      currentBlock.rightLineEnd = line.lineNumber.right ?? currentBlock.rightLineEnd;
      currentBlock.lines.push(line);
    }
  }

  if (currentBlock) {
    blocks.push(currentBlock);
  }

  return blocks;
}

export function getDiffBlocks(blocks: DiffBlock[]): DiffBlock[] {
  return blocks.filter(block => block.type !== 'unchanged');
}

export function findNextDiffBlockIndex(blocks: DiffBlock[], currentBlockIndex: number): number {
  const diffBlocks = blocks.map((b, i) => ({ block: b, index: i }))
    .filter(({ block }) => block.type !== 'unchanged');

  const next = diffBlocks.find(({ index }) => index > currentBlockIndex);
  return next?.index ?? diffBlocks[0]?.index ?? currentBlockIndex;
}

export function findPrevDiffBlockIndex(blocks: DiffBlock[], currentBlockIndex: number): number {
  const diffBlocks = blocks.map((b, i) => ({ block: b, index: i }))
    .filter(({ block }) => block.type !== 'unchanged');

  const prev = [...diffBlocks].reverse().find(({ index }) => index < currentBlockIndex);
  return prev?.index ?? diffBlocks[diffBlocks.length - 1]?.index ?? currentBlockIndex;
}
