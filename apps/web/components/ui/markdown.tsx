'use client';

import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { cn } from '@/lib/utils';

interface MarkdownProps {
  children: string;
  className?: string;
}

function Markdown({ children, className }: MarkdownProps) {
  return (
    <div
      className={cn('prose prose-sm dark:prose-invert max-w-none', className)}
    >
      <ReactMarkdown
        components={{
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
            return <>{children}</>;
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

export { Markdown };
