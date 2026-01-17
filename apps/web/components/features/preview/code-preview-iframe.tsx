"use client";

import * as React from "react";
import { transform } from "sucrase";

import { cn } from "@/lib/utils";

interface CodePreviewIframeProps extends React.ComponentProps<"div"> {
  /** AI가 생성한 React 컴포넌트 코드 */
  code: string;
  /** 파일 경로 (표시용) */
  filePath?: string;
}

/**
 * AI 생성 React 코드를 iframe 내에서 렌더링하는 컴포넌트
 *
 * - Sucrase로 JSX/TypeScript 트랜스파일
 * - @/components import를 window.AplusUI로 매핑
 * - React 19 UMD + @aplus/ui UMD 번들 사용
 */
function CodePreviewIframe({
  code,
  filePath,
  className,
  ...props
}: CodePreviewIframeProps) {
  const { srcDoc, error } = React.useMemo(() => {
    try {
      // 1. import 문에서 사용된 컴포넌트 목록 추출
      const componentImportMatch = code.match(
        /import\s+\{([^}]+)\}\s+from\s+['"]@\/components['"]/
      );
      const importedComponents = componentImportMatch
        ? componentImportMatch[1]
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      // 2. import 문 제거
      let processedCode = code
        // @/components import 제거
        .replace(
          /import\s+\{[^}]+\}\s+from\s+['"]@\/components['"];?\n?/g,
          ""
        )
        // react import 제거
        .replace(/import\s+\{[^}]+\}\s+from\s+['"]react['"];?\n?/g, "")
        .replace(/import\s+\*\s+as\s+React\s+from\s+['"]react['"];?\n?/g, "")
        .replace(/import\s+React\s+from\s+['"]react['"];?\n?/g, "");

      // 3. 컴포넌트 이름 추출 및 export 처리 (다양한 패턴 지원)
      let componentName = "App";

      // Pattern 1: export default function ComponentName() {}
      const namedFunctionMatch = processedCode.match(
        /export\s+default\s+function\s+(\w+)/
      );
      if (namedFunctionMatch) {
        componentName = namedFunctionMatch[1];
        processedCode = processedCode.replace(/export\s+default\s+/, "");
      }
      // Pattern 2: export default ComponentName (변수/함수 참조)
      else {
        const namedExportMatch = processedCode.match(
          /export\s+default\s+(\w+)\s*;?\s*$/m
        );
        if (namedExportMatch) {
          componentName = namedExportMatch[1];
          // export default ComponentName; 제거
          processedCode = processedCode.replace(
            /export\s+default\s+\w+\s*;?\s*$/m,
            ""
          );
        }
        // Pattern 3: export default () => {} 또는 export default function() {}
        else {
          const anonymousMatch = processedCode.match(
            /export\s+default\s+(function\s*\(|\(|\(\s*\))/
          );
          if (anonymousMatch) {
            // 익명 함수를 App 변수로 래핑
            processedCode = processedCode.replace(
              /export\s+default\s+/,
              "const App = "
            );
            componentName = "App";
          }
        }
      }

      const codeWithoutImports = processedCode;

      // 4. Sucrase로 JSX/TypeScript 트랜스파일
      const { code: transpiledCode } = transform(codeWithoutImports, {
        transforms: ["jsx", "typescript"],
        jsxRuntime: "classic",
      });

      // 5. 사용된 컴포넌트들을 window.AplusUI에서 가져오는 코드 생성
      const componentDestructure =
        importedComponents.length > 0
          ? `const { ${importedComponents.join(", ")} } = window.AplusUI;`
          : "";

      // 6. HTML 생성
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
  <script src="/api/ui-bundle"></script>
  <link href="/api/ui-bundle/css" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    #root { min-height: 100vh; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      try {
        // React hooks
        const { useState, useEffect, useCallback, useMemo, useRef } = React;

        // @aplus/ui 컴포넌트 (없는 컴포넌트는 div로 폴백)
        const AplusUI = window.AplusUI || {};
        const missingComponents = [];
        ${
          importedComponents.length > 0
            ? importedComponents
                .map(
                  (comp) =>
                    `const ${comp} = AplusUI.${comp} || (function() { missingComponents.push('${comp}'); return function(props) { return React.createElement('div', { style: { padding: '8px', border: '1px dashed #ccc', borderRadius: '4px', background: '#f9f9f9' }, ...props }, props.children || '[${comp}]'); }; })();`
                )
                .join("\n        ")
            : ""
        }

        if (missingComponents.length > 0) {
          console.warn('[Preview] Missing components from @aplus/ui:', missingComponents.join(', '));
        }

        // 트랜스파일된 컴포넌트 코드
        ${transpiledCode}

        // 렌더링
        const root = ReactDOM.createRoot(document.getElementById('root'));
        root.render(React.createElement(${componentName}));
      } catch (err) {
        document.getElementById('root').innerHTML =
          '<div style="padding: 24px; color: #dc2626; font-family: monospace;">' +
          '<strong>렌더링 에러:</strong><br><pre style="white-space: pre-wrap;">' +
          err.message + '</pre></div>';
        console.error('Preview render error:', err);
      }
    })();
  </script>
</body>
</html>`;

      return { srcDoc: html, error: null };
    } catch (err) {
      return {
        srcDoc: null,
        error: err instanceof Error ? err.message : "트랜스파일 에러",
      };
    }
  }, [code]);

  // 에러 상태 렌더링
  if (error) {
    return (
      <div
        data-slot="code-preview-iframe"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-4 bg-red-50 p-8 text-center",
          className
        )}
        {...props}
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-red-100">
          <svg
            className="size-8 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="font-medium text-red-800">코드 변환 에러</p>
          <p className="font-mono text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  // 코드가 없을 때
  if (!code) {
    return (
      <div
        data-slot="code-preview-iframe"
        className={cn(
          "flex flex-1 flex-col items-center justify-center gap-4 bg-muted/50 p-8 text-center text-muted-foreground",
          className
        )}
        {...props}
      >
        <div className="flex size-16 items-center justify-center rounded-full bg-muted">
          <svg
            className="size-8"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg>
        </div>
        <div className="space-y-1">
          <p className="font-medium">코드 미리보기</p>
          <p className="text-sm">AI가 생성한 코드가 여기에 표시됩니다</p>
        </div>
      </div>
    );
  }

  return (
    <div
      data-slot="code-preview-iframe"
      className={cn("relative flex flex-1 flex-col overflow-hidden", className)}
      {...props}
    >
      {/* 파일 경로 표시 (옵션) */}
      {filePath && (
        <div className="flex items-center gap-2 border-b bg-muted/30 px-3 py-1.5 text-xs text-muted-foreground">
          <svg
            className="size-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <span className="font-mono">{filePath}</span>
        </div>
      )}
      <iframe
        srcDoc={srcDoc || undefined}
        title="Code Preview"
        className="h-full w-full flex-1 border-0"
        sandbox="allow-scripts"
      />
    </div>
  );
}

export { CodePreviewIframe };
export type { CodePreviewIframeProps };
