'use client';

import * as React from 'react';
import { transform } from 'sucrase';

import { cn } from '@/lib/utils';

// AG Grid CDN URL (v34.2.0 고정)
const AG_GRID_CDN = 'https://cdn.jsdelivr.net/npm/ag-grid-community@34.2.0';

type PreviewViewMode = 'fit' | 'transform' | 'viewport';

interface CodePreviewIframeProps extends React.ComponentProps<'div'> {
  /** AI가 생성한 React 컴포넌트 코드 */
  code: string;
  /** 파일 경로 (표시용) */
  filePath?: string;
  /** 프리뷰 뷰 모드 */
  viewMode?: PreviewViewMode;
}

/**
 * AI 생성 React 코드를 iframe 내에서 렌더링하는 컴포넌트
 *
 * - Sucrase로 JSX/TypeScript 트랜스파일
 * - @/components import를 window.AplusUI로 매핑
 * - AG Grid 컴포넌트 지원 (CDN 기반)
 * - React 18 UMD + @aplus/ui UMD 번들 사용
 */
function CodePreviewIframe({
  code,
  filePath,
  viewMode = 'viewport',
  className,
  ...props
}: CodePreviewIframeProps) {
  // 부모 페이지에서 UMD 번들/CSS를 fetch하여 인라인 삽입
  // public/ 정적 파일로 서빙 → Deployment Protection 영향 없음, CDN 직접 서빙
  const [umdBundle, setUmdBundle] = React.useState<string | null>(null);
  const [umdCss, setUmdCss] = React.useState<string | null>(null);

  React.useEffect(() => {
    Promise.all([
      fetch('/ui-bundle.js').then((r) => {
        if (!r.ok) return '';
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('javascript')) return '';
        return r.text();
      }),
      fetch('/ui-bundle.css').then((r) => {
        if (!r.ok) return '';
        const ct = r.headers.get('content-type') || '';
        if (!ct.includes('css')) return '';
        return r.text();
      }),
    ]).then(([js, css]) => {
      setUmdBundle(js);
      setUmdCss(css);
    });
  }, []);

  // ResizeObserver로 컨테이너 크기 측정 (fit/transform 모드용)
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = React.useState({
    width: 0,
    height: 0,
  });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setContainerSize({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Scale 계산
  const needsTransform = viewMode === 'fit' || viewMode === 'transform';
  const scale = React.useMemo(() => {
    if (!needsTransform || containerSize.width === 0) return 1;
    const raw = containerSize.width / 1920;
    return viewMode === 'fit' ? Math.min(1, raw) : raw;
  }, [viewMode, needsTransform, containerSize.width]);

  const { srcDoc, error } = React.useMemo(() => {
    try {
      // 1. AG Grid 사용 여부 감지
      const hasAgGrid =
        /import\s+\{[^}]*AgGridReact[^}]*\}\s+from\s+['"]ag-grid-react['"]/.test(
          code
        );

      // 2. import 문에서 사용된 @/components 컴포넌트 목록 추출
      const componentImportMatch = code.match(
        /import\s+\{([^}]+)\}\s+from\s+['"]@\/components['"]/
      );
      const importedComponents = componentImportMatch
        ? componentImportMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      // 2-1. @aplus/ui import에서 컴포넌트 목록 추출
      const aplusUiImportMatch = code.match(
        /import\s+\{([^}]+)\}\s+from\s+['"]@aplus\/ui['"]/
      );
      const aplusUiComponents = aplusUiImportMatch
        ? aplusUiImportMatch[1]
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [];

      // 2-2. DataGrid 사용 감지 → AG Grid CDN 로딩 필요 여부
      // @aplus/ui와 @/components 양쪽 모두 체크
      const hasDataGrid =
        aplusUiComponents.includes('DataGrid') ||
        importedComponents.includes('DataGrid');
      const needsAgGrid = hasAgGrid || hasDataGrid;

      // 2-3. AG Grid 관련 exports는 커스텀 래퍼로 주입 → UMD 매핑에서 제외
      const agGridRelatedExports = [
        'DataGrid',
        'COLUMN_TYPES',
        'AgGridUtils',
        'ButtonCellRenderer',
        'CheckboxCellRenderer',
        'ImageCellRenderer',
        'DataGridProps',
      ];
      const nonAgGridAplusComponents = aplusUiComponents.filter(
        (c) => !agGridRelatedExports.includes(c)
      );
      // @/components import에서도 AG Grid 관련 컴포넌트 필터링 (const 중복 선언 방지)
      const nonAgGridImportedComponents = needsAgGrid
        ? importedComponents.filter((c) => !agGridRelatedExports.includes(c))
        : importedComponents;

      // 3. import 문 제거
      let processedCode = code
        // @/components import 제거
        .replace(/import\s+\{[^}]+\}\s+from\s+['"]@\/components['"];?\n?/g, '')
        // react import 제거
        .replace(/import\s+\{[^}]+\}\s+from\s+['"]react['"];?\n?/g, '')
        .replace(/import\s+\*\s+as\s+React\s+from\s+['"]react['"];?\n?/g, '')
        .replace(/import\s+React\s+from\s+['"]react['"];?\n?/g, '')
        // AG Grid 관련 import 제거
        .replace(
          /import\s+\{[^}]*AgGridReact[^}]*\}\s+from\s+['"]ag-grid-react['"];?\n?/g,
          ''
        )
        .replace(
          /import\s+\{[^}]*dsRuntimeTheme[^}]*\}\s+from\s+['"]@\/themes\/agGridTheme['"];?\n?/g,
          ''
        )
        // type-only imports 제거 (ag-grid-community)
        .replace(
          /import\s+type\s+\{[^}]+\}\s+from\s+['"]ag-grid-community['"];?\n?/g,
          ''
        )
        // value imports from ag-grid-community 제거
        .replace(
          /import\s+\{[^}]+\}\s+from\s+['"]ag-grid-community['"];?\n?/g,
          ''
        )
        // @aplus/ui import 제거
        .replace(/import\s+\{[^}]+\}\s+from\s+['"]@aplus\/ui['"];?\n?/g, '')
        .replace(
          /import\s+\{[^}]+\}\s+from\s+['"]@aplus\/ui\/[^'"]*['"];?\n?/g,
          ''
        );

      // 4. 컴포넌트 이름 추출 및 export 처리 (다양한 패턴 지원)
      let componentName = 'App';

      // Pattern 1: export default function ComponentName() {}
      const namedFunctionMatch = processedCode.match(
        /export\s+default\s+function\s+(\w+)/
      );
      if (namedFunctionMatch) {
        componentName = namedFunctionMatch[1];
        processedCode = processedCode.replace(/export\s+default\s+/, '');
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
            ''
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
              'const App = '
            );
            componentName = 'App';
          }
        }
      }

      const codeWithoutImports = processedCode;

      // 5. Sucrase로 JSX/TypeScript 트랜스파일
      const { code: transpiledCode } = transform(codeWithoutImports, {
        transforms: ['jsx', 'typescript'],
        jsxRuntime: 'classic',
      });

      // 6. AG Grid 인라인 래퍼 코드 생성
      const agGridWrapperCode = needsAgGrid
        ? `
        // AG Grid 인라인 래퍼 컴포넌트 (ag-grid-react UMD가 v34에서 작동하지 않으므로 직접 구현)
        const AgGridReact = React.forwardRef(function AgGridReact(props, ref) {
          const containerRef = React.useRef(null);
          const gridApiRef = React.useRef(null);

          // React cellRenderer → AG Grid vanilla 클래스 어댑터
          // createGrid() API는 React 컴포넌트를 직접 사용 불가하므로,
          // ReactDOM.createRoot()로 셀 내부에 React 컴포넌트를 렌더링
          function createReactCellRenderer(ReactComp) {
            function Adapter() {}
            Adapter.prototype.init = function(params) {
              this.eGui = document.createElement('div');
              this.eGui.style.display = 'contents';
              this.root = ReactDOM.createRoot(this.eGui);
              this.root.render(React.createElement(ReactComp, params));
            };
            Adapter.prototype.getGui = function() {
              return this.eGui;
            };
            Adapter.prototype.destroy = function() {
              if (this.root) {
                this.root.unmount();
                this.root = null;
              }
            };
            return Adapter;
          }

          // columnDefs 전처리 - React cellRenderer를 vanilla 어댑터 클래스로 래핑
          // 컬럼 그룹의 children까지 재귀적으로 처리
          function sanitizeColumnDefs(cols) {
            return (cols || []).map(function(col) {
              var rest = Object.assign({}, col);
              var renderer = rest.cellRenderer;
              if (typeof renderer === 'function') {
                // React 컴포넌트/함수를 AG Grid vanilla 클래스로 래핑
                rest.cellRenderer = createReactCellRenderer(renderer);
                // cellRendererParams는 보존 (AG Grid가 params에 머지하여 렌더러에 전달)
              } else if (typeof renderer === 'string') {
                // 문자열 렌더러 이름은 지원 불가 → 제거
                delete rest.cellRenderer;
                delete rest.cellRendererParams;
              }
              delete rest.cellRendererFramework;
              if (rest.children) {
                rest.children = sanitizeColumnDefs(rest.children);
              }
              return rest;
            });
          }

          React.useEffect(() => {
            if (!containerRef.current) return;
            var destroyed = false;
            var pollTimer = null;
            var pollCount = 0;
            var MAX_POLLS = 300; // 100ms × 300 = 30초

            function tryInit() {
              if (destroyed) return;
              if (!window.agGrid) {
                pollCount++;
                if (pollCount < MAX_POLLS) {
                  pollTimer = setTimeout(tryInit, 100);
                } else {
                  console.error('[AgGridReact] AG Grid CDN 로딩 타임아웃 (30초)');
                }
                return;
              }
              createGridInstance();
            }

            function createGridInstance() {
              if (destroyed || !containerRef.current) return;

              const { AllCommunityModule, ModuleRegistry, createGrid, themeQuartz } = window.agGrid;

              // 모듈 등록 (v34 필수, 한 번만 실행)
              if (!window.__AG_GRID_REGISTERED__) {
                ModuleRegistry.registerModules([AllCommunityModule]);
                window.__AG_GRID_REGISTERED__ = true;
              }

              var sanitizedColumnDefs = sanitizeColumnDefs(props.columnDefs);

              // 그리드 옵션 구성
              const gridOptions = {
                rowData: props.rowData || [],
                columnDefs: sanitizedColumnDefs,
                pagination: props.pagination,
                paginationPageSize: props.paginationPageSize || 20,
                paginationPageSizeSelector: props.paginationPageSizeSelector || [10, 20, 50, 100],
                rowSelection: props.rowSelection,
                animateRows: props.animateRows !== false,
                theme: props.theme || themeQuartz,
                defaultColDef: props.defaultColDef || { flex: 1, filter: true, sortable: true, resizable: true },
                onGridReady: function(params) {
                  gridApiRef.current = params.api;
                  if (props.onGridReady) props.onGridReady(params);
                },
                onSelectionChanged: props.onSelectionChanged,
                onCellClicked: props.onCellClicked,
                onRowSelected: props.onRowSelected,
                onFilterChanged: props.onFilterChanged,
                onSortChanged: props.onSortChanged,
              };

              // 그리드 생성
              const api = createGrid(containerRef.current, gridOptions);
              gridApiRef.current = api;
            }

            tryInit();

            return function() {
              destroyed = true;
              if (pollTimer) clearTimeout(pollTimer);
              if (gridApiRef.current) {
                gridApiRef.current.destroy();
                gridApiRef.current = null;
              }
            };
          }, []);

          // rowData 변경 시 업데이트
          React.useEffect(() => {
            if (gridApiRef.current && props.rowData) {
              gridApiRef.current.setGridOption('rowData', props.rowData);
            }
          }, [props.rowData]);

          // columnDefs 변경 시 업데이트 (cellRenderer 제거)
          React.useEffect(() => {
            if (gridApiRef.current && props.columnDefs) {
              var sanitized = sanitizeColumnDefs(props.columnDefs);
              gridApiRef.current.setGridOption('columnDefs', sanitized);
            }
          }, [props.columnDefs]);

          return React.createElement('div', {
            ref: containerRef,
            style: { width: '100%', height: '100%' },
            className: 'ag-theme-quartz'
          });
        });

        // dsRuntimeTheme - AG Grid Quartz 테마 사용 (CDN 미로딩 시 안전 접근)
        const dsRuntimeTheme = (window.agGrid && window.agGrid.themeQuartz) || null;

        // ag-grid-community exports 매핑
        const ModuleRegistry = window.agGrid.ModuleRegistry;
        const AllCommunityModule = window.agGrid.AllCommunityModule;

        // DataGrid 래퍼 - @aplus/ui DataGrid의 프리뷰 버전
        // 내부적으로 위에서 정의한 AgGridReact 커스텀 래퍼를 사용
        const DataGrid = function DataGrid(props) {
          var wrapperRef = React.useRef(null);
          var measuredH = React.useState(null);
          var setMeasuredH = measuredH[1];
          measuredH = measuredH[0];

          var rowData = props.rowData;
          var columnDefs = props.columnDefs;
          var height = props.height !== undefined ? props.height : 400;
          var width = props.width !== undefined ? props.width : '100%';
          var className = props.className || '';
          var pagination = props.pagination;
          var paginationPageSize = props.paginationPageSize;
          var paginationPageSizeSelector = props.paginationPageSizeSelector;
          var domLayout = props.domLayout;
          var rowSelection = props.rowSelection;
          var enableFilter = props.enableFilter !== undefined ? props.enableFilter : true;
          var enableSorting = props.enableSorting !== undefined ? props.enableSorting : true;
          var animateRows = props.animateRows;
          var defaultColDef = props.defaultColDef;
          var onGridReady = props.onGridReady;
          var onSelectionChanged = props.onSelectionChanged;
          var onCellClicked = props.onCellClicked;
          var onRowSelected = props.onRowSelected;
          var onFilterChanged = props.onFilterChanged;
          var onSortChanged = props.onSortChanged;
          var onCellValueChanged = props.onCellValueChanged;
          var onColumnMoved = props.onColumnMoved;

          // 퍼센트 높이가 flex 컨텍스트에서 해결되지 않을 때 부모의 실제 높이를 측정
          React.useEffect(function() {
            if (!wrapperRef.current) return;
            var parent = wrapperRef.current.parentElement;
            if (!parent) return;

            function measure() {
              var h = parent.clientHeight;
              if (h > 50) setMeasuredH(function(prev) { return prev === h ? prev : h; });
            }

            requestAnimationFrame(measure);

            var observer = null;
            if (window.ResizeObserver) {
              observer = new ResizeObserver(measure);
              observer.observe(parent);
            }

            return function() {
              if (observer) observer.disconnect();
            };
          }, []);

          var mergedDefaultColDef = Object.assign(
            { sortable: enableSorting, filter: enableFilter, resizable: true },
            defaultColDef || {}
          );

          // 퍼센트 높이인 경우 측정된 부모 높이(px)를 사용
          var effectiveHeight = height;
          if (typeof height === 'string' && height.indexOf('%') !== -1 && measuredH) {
            effectiveHeight = measuredH;
          }

          return React.createElement('div', { ref: wrapperRef, className: className, style: { height: effectiveHeight, width: width } },
            React.createElement(AgGridReact, {
              rowData: rowData,
              columnDefs: columnDefs,
              defaultColDef: mergedDefaultColDef,
              pagination: pagination,
              paginationPageSize: paginationPageSize,
              paginationPageSizeSelector: paginationPageSizeSelector,
              domLayout: domLayout,
              rowSelection: rowSelection,
              animateRows: animateRows,
              onGridReady: onGridReady,
              onSelectionChanged: onSelectionChanged,
              onCellClicked: onCellClicked,
              onRowSelected: onRowSelected,
              onFilterChanged: onFilterChanged,
              onSortChanged: onSortChanged,
              onCellValueChanged: onCellValueChanged,
              onColumnMoved: onColumnMoved,
            })
          );
        };

        // COLUMN_TYPES - 미리 정의된 컬럼 타입
        const COLUMN_TYPES = {
          numberColumn: { width: 130, filter: 'agNumberColumnFilter', cellClass: 'ag-right-aligned-cell', headerClass: 'ag-right-aligned-header' },
          dateColumn: { filter: 'agDateColumnFilter', cellEditor: 'agDateCellEditor', width: 150 },
          currencyColumn: { width: 150, filter: 'agNumberColumnFilter', cellClass: 'ag-right-aligned-cell', headerClass: 'ag-right-aligned-header',
            valueFormatter: function(params) { if (params.value == null) return ''; return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(params.value); }
          },
          percentColumn: { width: 130, filter: 'agNumberColumnFilter', cellClass: 'ag-right-aligned-cell', headerClass: 'ag-right-aligned-header',
            valueFormatter: function(params) { if (params.value == null) return ''; return params.value + '%'; }
          },
        };

        // AgGridUtils - 그리드 유틸리티 함수
        const AgGridUtils = {
          exportToCsv: function(api, f) { api.exportDataAsCsv({ fileName: f || 'export_' + Date.now() + '.csv' }); },
          exportToExcel: function(api, f) { api.exportDataAsExcel({ fileName: f || 'export_' + Date.now() + '.xlsx' }); },
          getSelectedRows: function(api) { return api.getSelectedRows(); },
          selectAll: function(api) { api.selectAll(); },
          deselectAll: function(api) { api.deselectAll(); },
          scrollToRow: function(api, i) { api.ensureIndexVisible(i); },
          autoSizeAllColumns: function(api) { var ids = (api.getColumns() || []).map(function(c) { return c.getColId(); }); api.autoSizeColumns(ids); },
          getFilterModel: function(api) { return api.getFilterModel(); },
          setFilterModel: function(api, m) { api.setFilterModel(m); },
          getSortModel: function(api) { return api.getColumnState(); },
          setSortModel: function(api, m) { api.applyColumnState({ state: m }); },
        };

        // 셀 렌더러 폴백 (vanilla AG Grid에서는 React 셀 렌더러 미지원 - 참조용)
        const ButtonCellRenderer = function(props) { return React.createElement('button', { style: { padding: '4px 8px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' } }, props.value || '클릭'); };
        const CheckboxCellRenderer = function(props) { return React.createElement('input', { type: 'checkbox', checked: !!props.value, readOnly: true }); };
        const ImageCellRenderer = function(props) { return React.createElement('img', { src: props.value, alt: 'cell image', style: { width: 30, height: 30, objectFit: 'cover', borderRadius: '4px' } }); };
        `
        : '';

      // 7. HTML 생성
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="${viewMode === 'viewport' ? 'width=1920, initial-scale=1' : 'width=device-width, initial-scale=1'}">
  <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
  <script crossorigin src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>tailwind.config = { corePlugins: { preflight: false } }</script>
  ${
    needsAgGrid
      ? `
  <!-- AG Grid CDN (v34.2.0) - Theming API 사용으로 ag-grid.css 불필요 -->
  <script src="${AG_GRID_CDN}/dist/ag-grid-community.min.js"></script>
  <link href="${AG_GRID_CDN}/styles/ag-theme-quartz.min.css" rel="stylesheet">
  `
      : ''
  }
  ${umdBundle ? `<script>${umdBundle.replace(/<\/script>/gi, '<\\/script>')}</script>` : ''}
  ${umdCss ? `<style>${umdCss}</style>` : ''}
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }
    #root { min-height: 100vh; }
    /* AG Grid 컨테이너 기본 높이 */
    .ag-theme-quartz { min-height: 200px; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script>
    (function() {
      try {
        // React hooks
        const { useState, useEffect, useCallback, useMemo, useRef, forwardRef } = React;

        // @aplus/ui 컴포넌트 (없는 컴포넌트는 div로 폴백)
        // AG Grid 관련 컴포넌트는 커스텀 래퍼로 주입되므로 제외
        const AplusUI = window.AplusUI || {};
        const missingComponents = [];
        ${
          nonAgGridImportedComponents.length > 0
            ? nonAgGridImportedComponents
                .map(
                  (comp) =>
                    `const ${comp} = AplusUI.${comp} || (function() { missingComponents.push('${comp}'); return function(props) { return React.createElement('div', { style: { padding: '8px', border: '1px dashed #ccc', borderRadius: '4px', background: '#f9f9f9' }, ...props }, props.children || '[${comp}]'); }; })();`
                )
                .join('\n        ')
            : ''
        }

        // @aplus/ui 컴포넌트 매핑 (AG Grid 관련은 커스텀 래퍼로 주입되므로 제외)
        ${
          nonAgGridAplusComponents.length > 0
            ? nonAgGridAplusComponents
                .map(
                  (comp) =>
                    `const ${comp} = AplusUI.${comp} || (function() { missingComponents.push('${comp}'); return function(props) { return React.createElement('div', { style: { padding: '8px', border: '1px dashed #ccc', borderRadius: '4px', background: '#f9f9f9' }, ...props }, props.children || '[${comp}]'); }; })();`
                )
                .join('\n        ')
            : ''
        }

        if (missingComponents.length > 0) {
          console.warn('[Preview] Missing components from @aplus/ui:', missingComponents.join(', '));
        }

        ${agGridWrapperCode}

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
        error: err instanceof Error ? err.message : '트랜스파일 에러',
      };
    }
  }, [code, viewMode, umdBundle, umdCss]);

  // 에러 상태 렌더링
  if (error) {
    return (
      <div
        data-slot="code-preview-iframe"
        className={cn(
          'flex flex-1 flex-col items-center justify-center gap-4 bg-red-50 p-8 text-center',
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
          'flex flex-1 flex-col items-center justify-center gap-4 bg-muted/50 p-8 text-center text-muted-foreground',
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
      className={cn(
        'relative flex h-full flex-1 flex-col overflow-hidden',
        className
      )}
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
      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        <iframe
          srcDoc={srcDoc || undefined}
          title="Code Preview"
          sandbox="allow-scripts"
          className={needsTransform ? '' : 'h-full w-full flex-1 border-0'}
          style={
            needsTransform && containerSize.width > 0
              ? {
                  width: '1920px',
                  height: `${containerSize.height / scale}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  border: 'none',
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}

export { CodePreviewIframe };
export type { CodePreviewIframeProps, PreviewViewMode };
