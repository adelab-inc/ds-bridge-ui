'use client';

import * as React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface TypedMarkdownProps {
  children: string;
  className?: string;
}

// GFM 파이프 테이블은 row 가 한 줄 단위라, 셀 안에 raw `\n` 이 들어가면
// 파서가 row 를 조기 종료해 표가 두 동강 난다. 편집기에서 사용자가 셀 안에
// 줄바꿈을 입력한 경우(예: edited_content) 를 살리기 위해, row 가 미완성인
// 상태로 다음 줄이 등장하면 그 줄을 마지막 셀에 `<br/>` + 본문으로 병합한다.
function countUnescapedPipes(line: string): number {
  let n = 0;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '|' && line[i - 1] !== '\\') n++;
  }
  return n;
}

function isDelimiterRow(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function endsWithPipe(line: string): boolean {
  // 마지막 비공백 문자가 escape 되지 않은 `|` 인지
  const m = /([\\]?)\|\s*$/.exec(line);
  return !!m && m[1] !== '\\';
}

function isRowComplete(
  line: string,
  headerPipes: number,
  headerTrailingPipe: boolean
): boolean {
  if (headerTrailingPipe) return endsWithPipe(line);
  return countUnescapedPipes(line) >= headerPipes;
}

function normalizeTableCellNewlines(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inTable = false;
  let headerPipes = 0;
  let headerTrailing = false;
  let lastBodyIdx = -1; // 마지막으로 처리된 본문 row 의 out 인덱스 (구분선 직후 -1)

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!inTable) {
      const next = lines[i + 1];
      if (line.includes('|') && next && isDelimiterRow(next)) {
        inTable = true;
        headerPipes = countUnescapedPipes(line);
        headerTrailing = endsWithPipe(line);
        lastBodyIdx = -1;
      }
      out.push(line);
      continue;
    }
    // 직전 본문 row 가 미완성이면 이번 줄을 그 row 의 마지막 셀에 병합한다.
    // 빈 줄/파이프 없는 줄/파이프 있는 줄을 가리지 않는다 — 사용자가 셀 안에
    // bullet 같은 파이프 0개 라인을 직접 입력해도 표가 끊기지 않게 하기 위함.
    // 단, delimiter row 이거나 다음 줄이 delimiter 인 새 표 헤더 후보면 병합을
    // 멈추고 새 컨텍스트로 넘어간다.
    if (
      lastBodyIdx >= 0 &&
      !isRowComplete(out[lastBodyIdx], headerPipes, headerTrailing)
    ) {
      if (isDelimiterRow(line)) {
        out.push(line);
        lastBodyIdx = -1;
        continue;
      }
      const nextForHeader = lines[i + 1];
      if (
        line.includes('|') &&
        nextForHeader &&
        isDelimiterRow(nextForHeader)
      ) {
        headerPipes = countUnescapedPipes(line);
        headerTrailing = endsWithPipe(line);
        lastBodyIdx = -1;
        out.push(line);
        continue;
      }
      out[lastBodyIdx] = out[lastBodyIdx].replace(/\s*$/, '') + '<br/>' + line;
      continue;
    }
    // 표 종료: 빈 줄 또는 파이프가 전혀 없는 줄 (직전 row 가 완성된 경우만)
    if (line.trim() === '' || !line.includes('|')) {
      inTable = false;
      lastBodyIdx = -1;
      out.push(line);
      continue;
    }
    // 구분선은 그대로 보존하고 lastBodyIdx 초기화 유지
    if (isDelimiterRow(line)) {
      out.push(line);
      lastBodyIdx = -1;
      continue;
    }
    out.push(line);
    lastBodyIdx = out.length - 1;
  }
  return out.join('\n');
}

/**
 * 자체 타이포그래피 스타일을 가진 마크다운 렌더러
 * @tailwindcss/typography 없이 heading, table, list, hr 등을 스타일링
 */
function TypedMarkdown({ children, className }: TypedMarkdownProps) {
  const normalized = React.useMemo(
    () => normalizeTableCellNewlines(children),
    [children]
  );
  return (
    <div className={cn('max-w-none text-sm text-foreground', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-4 mt-6 text-2xl font-bold first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-3 mt-5 text-xl font-semibold first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-2 mt-4 text-base font-semibold first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="mb-2 mt-3 text-sm font-semibold first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="mb-3 leading-relaxed last:mb-0">{children}</p>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-3 border-l-2 border-muted-foreground/30 pl-4 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          ul: ({ children }) => (
            <ul className="my-2 ml-5 list-disc space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 ml-5 list-decimal space-y-1">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          hr: () => <hr className="my-4 border-border" />,
          strong: ({ children }) => (
            <strong className="font-semibold">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              className="text-primary underline underline-offset-2"
              target="_blank"
              rel="noopener noreferrer"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="border-b border-border bg-muted/50">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-t border-border px-3 py-2">{children}</td>
          ),
          code({ className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  borderRadius: '0.375rem',
                  fontSize: '0.75rem',
                }}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            );
          },
          pre({ children }) {
            return <div className="my-3">{children}</div>;
          },
        }}
      >
        {normalized}
      </ReactMarkdown>
    </div>
  );
}

export { TypedMarkdown };
export type { TypedMarkdownProps };
