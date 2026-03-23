'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface TypedMarkdownProps {
  children: string;
  className?: string;
}

/**
 * 자체 타이포그래피 스타일을 가진 마크다운 렌더러
 * @tailwindcss/typography 없이 heading, table, list, hr 등을 스타일링
 */
function TypedMarkdown({ children, className }: TypedMarkdownProps) {
  return (
    <div className={cn('max-w-none text-sm text-foreground', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
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
        {children}
      </ReactMarkdown>
    </div>
  );
}

export { TypedMarkdown };
export type { TypedMarkdownProps };
