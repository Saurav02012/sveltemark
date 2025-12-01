import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeKatex from 'rehype-katex';
import rehypeSlug from 'rehype-slug';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import type { Root as MdastRoot, RootContent } from 'mdast';
import type { Root as HastRoot, Element } from 'hast';
import { visit } from 'unist-util-visit';

// Custom plugin to inject source line numbers into HTML elements
function rehypeSourceLines() {
    return (tree: HastRoot) => {
        visit(tree, 'element', (node: Element) => {
            if (node.position?.start?.line) {
                node.properties = node.properties || {};
                node.properties['data-source-line'] = node.position.start.line;
            }
        });
    };
}

// Custom plugin to handle mermaid code blocks
function remarkMermaid() {
    return (tree: MdastRoot) => {
        visit(tree, 'code', (node: { lang?: string | null; meta?: string | null; value: string; type: string; data?: { hName?: string; hProperties?: Record<string, unknown> } }) => {
            if (node.lang === 'mermaid') {
                // Transform to a div that will be processed by mermaid.js client-side
                node.type = 'code';
                node.data = node.data || {};
                node.data.hName = 'div';
                node.data.hProperties = {
                    className: ['mermaid'],
                    'data-mermaid': node.value
                };
            }
        });
    };
}

// Create the unified processor
const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkMermaid)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeSlug)
    .use(rehypeSourceLines)
    .use(rehypeStringify, { allowDangerousHtml: true });

// Create a parser-only processor for splitting into blocks
const parser = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath);

// Block processor for individual blocks
const blockProcessor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkMath)
    .use(remarkMermaid)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeKatex)
    .use(rehypeHighlight, { detect: true, ignoreMissing: true })
    .use(rehypeSlug)
    .use(rehypeSourceLines)
    .use(rehypeStringify, { allowDangerousHtml: true });

/**
 * Represents a markdown block with its source and rendered HTML
 */
export interface MarkdownBlock {
    id: string;           // Unique identifier for diffing
    source: string;       // Original markdown source
    html: string;         // Rendered HTML
    startLine: number;    // Starting line number in source
    endLine: number;      // Ending line number in source
}

/**
 * Generate a unique ID for a block based on content and position
 */
function generateBlockId(source: string, startLine: number, index: number): string {
    // Use a combination of content hash, line number, and index for uniqueness
    let hash = 0;
    const str = source + '|' + startLine;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    // Include index to guarantee uniqueness even for identical content
    return `b${index}-${Math.abs(hash).toString(36)}-${startLine}`;
}

/**
 * Split markdown into top-level blocks
 */
export function splitIntoBlocks(markdown: string): { source: string; startLine: number; endLine: number }[] {
    if (!markdown.trim()) {
        return [];
    }

    const tree = parser.parse(markdown) as MdastRoot;
    const blocks: { source: string; startLine: number; endLine: number }[] = [];
    const lines = markdown.split('\n');

    for (const node of tree.children as RootContent[]) {
        if (node.position) {
            const startLine = node.position.start.line;
            const endLine = node.position.end.line;
            // Extract the source text for this block (1-indexed to 0-indexed)
            const source = lines.slice(startLine - 1, endLine).join('\n');
            blocks.push({ source, startLine, endLine });
        }
    }

    return blocks;
}

/**
 * Process a single markdown block to HTML
 */
export async function processBlock(source: string): Promise<string> {
    if (!source.trim()) return '';
    const result = await blockProcessor.process(source);
    return String(result);
}

/**
 * Process markdown into blocks with rendered HTML
 */
export async function processMarkdownBlocks(markdown: string): Promise<MarkdownBlock[]> {
    const rawBlocks = splitIntoBlocks(markdown);
    const processedBlocks: MarkdownBlock[] = [];

    for (let i = 0; i < rawBlocks.length; i++) {
        const block = rawBlocks[i];
        const html = await processBlock(block.source);
        processedBlocks.push({
            id: generateBlockId(block.source, block.startLine, i),
            source: block.source,
            html,
            startLine: block.startLine,
            endLine: block.endLine
        });
    }

    return processedBlocks;
}

/**
 * Diff old blocks vs new blocks and return update instructions
 * Compares by source content to detect actual changes
 */
export interface BlockDiff {
    type: 'add' | 'remove' | 'update' | 'keep';
    index: number;
    block?: MarkdownBlock;
    oldIndex?: number;
}

export function diffBlocks(oldBlocks: MarkdownBlock[], newBlocks: MarkdownBlock[]): BlockDiff[] {
    const diffs: BlockDiff[] = [];

    // Compare blocks by position and content
    const maxLen = Math.max(oldBlocks.length, newBlocks.length);

    for (let i = 0; i < maxLen; i++) {
        const oldBlock = oldBlocks[i];
        const newBlock = newBlocks[i];

        if (!oldBlock && newBlock) {
            // New block added at the end
            diffs.push({ type: 'add', index: i, block: newBlock });
        } else if (oldBlock && !newBlock) {
            // Block removed from the end
            diffs.push({ type: 'remove', index: i, oldIndex: i });
        } else if (oldBlock && newBlock) {
            // Both exist - compare content
            if (oldBlock.source === newBlock.source) {
                diffs.push({ type: 'keep', index: i, block: newBlock });
            } else {
                diffs.push({ type: 'update', index: i, block: newBlock, oldIndex: i });
            }
        }
    }

    return diffs;
}

/**
 * Process markdown string to HTML (legacy full render)
 */
export async function processMarkdown(markdown: string): Promise<string> {
    const result = await processor.process(markdown);
    return String(result);
}

/**
 * Synchronous version for when async isn't needed
 */
export function processMarkdownSync(markdown: string): string {
    const result = processor.processSync(markdown);
    return String(result);
}

// Export the processor for advanced use cases
export { processor };
