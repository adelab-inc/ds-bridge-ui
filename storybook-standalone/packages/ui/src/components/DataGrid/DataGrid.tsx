// React 및 AG Grid 관련 필수 라이브러리 import
import React, { useState, useCallback, useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';

// AG Grid v34 Theme API
import {
  ColDef,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
  CellClickedEvent,
  RowSelectedEvent,
  FilterChangedEvent,
  SortChangedEvent,
  CellValueChangedEvent,
  GridOptions,
  RowClassParams,
  GetRowIdParams,
  ValueFormatterParams,
  ICellRendererParams,
  ColumnMovedEvent,
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
} from 'ag-grid-community';

// Design Tokens import - packages/ui 토큰 시스템 사용
import { designTokens } from '../../tokens/design-tokens';

// AG Grid 모듈 등록 (v34 필수)
ModuleRegistry.registerModules([AllCommunityModule]);

/**
 * AG Grid 커스텀 테마 - Design Tokens 기반
 * packages/ui/src/tokens/design-tokens.ts의 토큰을 AG Grid Theme API에 직접 매핑
 * @see https://www.figma.com/design/m3MKIEBXCXtj4HCdJd2zS6/WSR?node-id=5084-157297
 */
const aplusGridTheme = themeQuartz.withParams({
  // === Colors: Background ===
  backgroundColor: designTokens.colors['bg-surface'],
  headerBackgroundColor: designTokens.colors['bg-surface'],
  oddRowBackgroundColor: designTokens.colors['bg-surface'],
  rowHoverColor: designTokens.colors['state-overlay-on-neutral-hover'],
  selectedRowBackgroundColor: designTokens.colors['bg-selection'],
  modalOverlayBackgroundColor: designTokens.colors['overlay-scrim'],

  // === Colors: Border ===
  borderColor: designTokens.colors['border-default'],
  rowBorder: { color: designTokens.colors['border-default'] },
  headerColumnBorder: { color: designTokens.colors['border-default'] },

  // === Colors: Text ===
  foregroundColor: designTokens.colors['text-primary'],
  headerTextColor: designTokens.colors['text-primary'],
  textColor: designTokens.colors['text-primary'],
  subtleTextColor: designTokens.colors['text-secondary'],

  // === Colors: Accent ===
  accentColor: designTokens.colors['brand-primary'],

  // === Colors: Input ===
  inputBorder: { color: designTokens.colors['field-border-default'] },
  inputFocusBorder: { color: designTokens.colors['field-border-focus'] },
  inputDisabledBackgroundColor: designTokens.colors['field-bg-disabled'],

  // === Colors: Checkbox ===
  checkboxCheckedBackgroundColor: designTokens.colors['control-bg-on'],
  checkboxUncheckedBackgroundColor: designTokens.colors['bg-surface'],
  checkboxUncheckedBorderColor: designTokens.colors['control-stroke-default'],

  // === Colors: Invalid ===
  invalidColor: designTokens.colors['semantic-error'],

  // === Spacing & Sizing ===
  cellHorizontalPadding: 12,
  cellWidgetSpacing: 8,
  rowHeight: 40,
  headerHeight: 42,
  spacing: 8,
  wrapperBorderRadius: 8,
  borderRadius: 6,

  // === Typography ===
  fontFamily: "'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: 14,
  headerFontSize: 14,
  headerFontWeight: 500,

  // === Icons ===
  iconSize: 16,
});

/**
 * 기본 셀 렌더러 컴포넌트들
 */

/**
 * 버튼 셀 렌더러 - 그리드 셀에 클릭 가능한 버튼을 렌더링합니다
 * @param props - AG Grid 셀 렌더러 props와 추가 onClick 핸들러
 */
export const ButtonCellRenderer: React.FC<ICellRendererParams & { onClick?: (data: any) => void }> = props => {
  // 버튼 클릭 핸들러
  const handleClick = () => {
    if ((props as any).onClick) {
      (props as any).onClick(props.data);
    }
  };

  return (
    <button
      onClick={handleClick}
      style={{
        padding: '4px 8px',
        backgroundColor: '#007bff',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      {props.value || '클릭'}
    </button>
  );
};

/**
 * 체크박스 셀 렌더러 - 그리드 셀에 체크박스를 렌더링합니다
 * @param props - AG Grid 셀 렌더러 props와 추가 체크박스 변경 핸들러
 */
export const CheckboxCellRenderer: React.FC<
  ICellRendererParams & { onCheckboxChange?: (data: any, checked: boolean) => void }
> = props => {
  return (
    <input
      type="checkbox"
      checked={props.value}
      onChange={e => {
        if ((props as any).onCheckboxChange) {
          (props as any).onCheckboxChange(props.data, e.target.checked);
        }
      }}
    />
  );
};

/**
 * 이미지 셀 렌더러 - 그리드 셀에 이미지를 렌더링합니다
 * @param props - AG Grid 셀 렌더러 props
 */
export const ImageCellRenderer: React.FC<ICellRendererParams> = props => {
  return (
    <img
      src={props.value}
      alt="cell image"
      style={{
        width: '30px',
        height: '30px',
        objectFit: 'cover',
        borderRadius: '4px',
      }}
    />
  );
};

/**
 * AG Grid 컴포넌트 Props 인터페이스
 * AG Grid 컴포넌트에서 사용할 수 있는 모든 속성들을 정의합니다
 */
export interface DataGridProps {
  /** 필수 Props */
  /** 그리드에 표시할 행 데이터 배열 */
  rowData: any[];
  /** 컬럼 정의 배열 */
  columnDefs: ColDef[];

  /** 테마 및 스타일 */
  /** 그리드 테마 선택 (quartz 권장 - Design Tokens 적용) */
  theme?: 'quartz' | 'alpine' | 'balham' | 'material' | 'custom';
  /** 그리드 높이 */
  height?: number | string;
  /** 그리드 너비 */
  width?: number | string;
  /** 추가 CSS 클래스명 */
  className?: string;

  /** 그리드 옵션 */
  /** 페이지네이션 활성화 여부 */
  pagination?: boolean;
  /** 페이지당 행 수 */
  paginationPageSize?: number;
  /** 페이지 크기 선택 옵션 */
  paginationPageSizeSelector?: number[];
  /** DOM 레이아웃 타입 */
  domLayout?: 'normal' | 'autoHeight' | 'print';

  /** 선택 옵션 */
  /** 행 선택 모드 (단일/다중) */
  rowSelection?: 'single' | 'multiple';

  /** 필터링 및 정렬 */
  /** 필터링 활성화 여부 */
  enableFilter?: boolean;
  /** 정렬 활성화 여부 */
  enableSorting?: boolean;
  /** 빠른 필터 텍스트 */
  quickFilterText?: string;

  /** 로딩 및 오버레이 */
  /** 로딩 상태 */
  loading?: boolean;
  /** 로딩 오버레이 컴포넌트 */
  loadingOverlayComponent?: string;
  /** 데이터 없음 오버레이 컴포넌트 */
  noRowsOverlayComponent?: string;

  /** 애니메이션 */
  /** 행 애니메이션 활성화 여부 */
  animateRows?: boolean;

  /** 행 그룹핑 */
  /** 자동 그룹 컬럼 정의 */
  autoGroupColumnDef?: ColDef;

  /** 편집 */
  /** 편집 타입 */
  editType?: 'fullRow';
  /** 셀 포커스 잃을 때 편집 중단 여부 */
  stopEditingWhenCellsLoseFocus?: boolean;

  /** 컨텍스트 메뉴 */
  /** 셀 선택 활성화 여부 */
  cellSelection?: boolean;
  /** 차트 기능 활성화 여부 */
  enableCharts?: boolean;

  /** 이벤트 핸들러 */
  /** 그리드 준비 완료 이벤트 */
  onGridReady?: (event: GridReadyEvent) => void;
  /** 선택 변경 이벤트 */
  onSelectionChanged?: (event: SelectionChangedEvent) => void;
  /** 셀 클릭 이벤트 */
  onCellClicked?: (event: CellClickedEvent) => void;
  /** 행 선택 이벤트 */
  onRowSelected?: (event: RowSelectedEvent) => void;
  /** 필터 변경 이벤트 */
  onFilterChanged?: (event: FilterChangedEvent) => void;
  /** 정렬 변경 이벤트 */
  onSortChanged?: (event: SortChangedEvent) => void;
  /** 셀 값 변경 이벤트 */
  onCellValueChanged?: (event: CellValueChangedEvent) => void;
  /** 컬럼 이동 이벤트 */
  onColumnMoved?: (event: ColumnMovedEvent) => void;
  /** 행 데이터 변경 이벤트 */
  onRowDataChanged?: () => void;

  /** 커스텀 함수들 */
  /** 행 ID 생성 함수 */
  getRowId?: (params: GetRowIdParams) => string;
  /** 행 CSS 클래스 생성 함수 */
  getRowClass?: (params: RowClassParams) => string | string[];

  /** 기본 컬럼 정의 */
  /** 모든 컬럼에 적용될 기본 속성 */
  defaultColDef?: ColDef;

  /** 사이드바 */
  /** 사이드바 설정 (필터, 컬럼 등) */
  sideBar?: boolean | string | any;

  /** 컬럼 순서를 유지합니다. true일 경우 컬럼을 드래그해도 원래 순서로 돌아갑니다. */
  maintainColumnOrder?: boolean;

  /** 무한 스크롤 */
  /** 행 모델 타입 */
  rowModelType?: 'clientSide' | 'infinite' | 'viewport' | 'serverSide';
  /** 엔터프라이즈 기능들은 cellSelection.handle로 통합됨 */
}

/**
 * 메인 AG Grid 컴포넌트
 * 재사용 가능한 AG Grid 래퍼 컴포넌트로 다양한 옵션을 제공합니다
 */
export const DataGrid: React.FC<DataGridProps> = ({
  rowData,
  columnDefs,
  theme = 'quartz',
  height = 400,
  width = '100%',
  className = '',
  pagination = false,
  paginationPageSize = 10,
  paginationPageSizeSelector = [10, 20, 50, 100],
  domLayout = 'normal',
  rowSelection,
  enableFilter = true,
  enableSorting = true,
  quickFilterText,
  loading = false,
  loadingOverlayComponent,
  noRowsOverlayComponent,
  animateRows = true,
  autoGroupColumnDef,
  editType,
  stopEditingWhenCellsLoseFocus = true,
  cellSelection = false,
  enableCharts = false,
  onGridReady,
  onSelectionChanged,
  onCellClicked,
  onRowSelected,
  onFilterChanged,
  onSortChanged,
  onCellValueChanged,
  onRowDataChanged,
  getRowId,
  getRowClass,
  defaultColDef,
  sideBar = false,
  maintainColumnOrder = true,
  rowModelType = 'clientSide',
  onColumnMoved,
  ...props
}) => {
  // AG Grid 레퍼런스
  const gridRef = useRef<AgGridReact>(null);
  // 그리드 API 상태
  const [gridApi, setGridApi] = useState<GridApi | null>(null);

  // 기본 컬럼 정의 메모이제이션
  const memoizedDefaultColDef = useMemo(
    () => ({
      sortable: enableSorting,
      filter: enableFilter,
      resizable: true,
      menuTabs: ['filterMenuTab' as any, 'generalMenuTab' as any],
      ...defaultColDef,
    }),
    [enableSorting, enableFilter, defaultColDef]
  );

  // 그리드 준비 이벤트 핸들러
  const handleGridReady = useCallback(
    (event: GridReadyEvent) => {
      setGridApi(event.api);

      if (onGridReady) {
        onGridReady(event);
      }
    },
    [onGridReady]
  );

  // 그리드 옵션 메모이제이션
  const gridOptions: GridOptions = useMemo(
    () => ({
      rowData,
      columnDefs,
      defaultColDef: memoizedDefaultColDef,
      pagination,
      paginationPageSize,
      paginationPageSizeSelector,
      domLayout,
      rowSelection: rowSelection === 'multiple' ? 'multiple' : rowSelection === 'single' ? 'single' : rowSelection,
      animateRows,
      autoGroupColumnDef,
      editType,
      stopEditingWhenCellsLoseFocus,
      cellSelection,
      enableCharts,
      getRowId,
      getRowClass,
      sideBar,
      maintainColumnOrder,
      rowModelType,
      loadingOverlayComponent,
      noRowsOverlayComponent,
      suppressMenuHide: true,
      suppressMovableColumns: false,
      ...props,
    }),
    [
      rowData,
      columnDefs,
      memoizedDefaultColDef,
      pagination,
      paginationPageSize,
      paginationPageSizeSelector,
      domLayout,
      rowSelection,
      animateRows,
      autoGroupColumnDef,
      editType,
      stopEditingWhenCellsLoseFocus,
      cellSelection,
      enableCharts,
      getRowId,
      getRowClass,
      sideBar,
      maintainColumnOrder,
      rowModelType,
      loadingOverlayComponent,
      noRowsOverlayComponent,
      props,
    ]
  );

  // 퀵 필터 적용 이펙트
  React.useEffect(() => {
    if (gridApi && quickFilterText !== undefined) {
      gridApi.setGridOption('quickFilterText', quickFilterText);
    }
  }, [gridApi, quickFilterText]);

  // 로딩 상태 처리 이펙트
  React.useEffect(() => {
    if (gridApi) {
      if (loading) {
        gridApi.setGridOption('loading', true);
      } else {
        gridApi.setGridOption('loading', false);
      }
    }
  }, [gridApi, loading]);

  return (
    <div className={className} style={{ height, width }}>
      {React.createElement(AgGridReact as any, {
        ref: gridRef,
        theme: aplusGridTheme,
        ...gridOptions,
        onGridReady: handleGridReady,
        onSelectionChanged: onSelectionChanged,
        onCellClicked: onCellClicked,
        onRowSelected: onRowSelected,
        onFilterChanged: onFilterChanged,
        onSortChanged: onSortChanged,
        onCellValueChanged: onCellValueChanged,
        onColumnMoved: onColumnMoved,
      })}
    </div>
  );
};

/**
 * 사전 정의된 컬럼 타입들
 * 자주 사용되는 컬럼 타입들을 미리 정의해놓은 객체
 */
export const COLUMN_TYPES = {
  /** 숫자 컬럼 타입 */
  numberColumn: {
    width: 130,
    filter: 'agNumberColumnFilter',
    cellClass: 'ag-right-aligned-cell',
    headerClass: 'ag-right-aligned-header',
  },
  /** 날짜 컬럼 타입 */
  dateColumn: {
    filter: 'agDateColumnFilter',
    cellEditor: 'agDateCellEditor',
    width: 150,
  },
  /** 통화 컬럼 타입 */
  currencyColumn: {
    width: 150,
    filter: 'agNumberColumnFilter',
    cellClass: 'ag-right-aligned-cell',
    headerClass: 'ag-right-aligned-header',
    valueFormatter: (params: ValueFormatterParams) => {
      if (params.value == null) return '';
      return new Intl.NumberFormat('ko-KR', {
        style: 'currency',
        currency: 'KRW',
      }).format(params.value);
    },
  },
  /** 퍼센트 컬럼 타입 */
  percentColumn: {
    width: 130,
    filter: 'agNumberColumnFilter',
    cellClass: 'ag-right-aligned-cell',
    headerClass: 'ag-right-aligned-header',
    valueFormatter: (params: ValueFormatterParams) => {
      if (params.value == null) return '';
      return `${params.value}%`;
    },
  },
};

/**
 * AG Grid 유틸리티 함수들
 * 그리드 조작을 위한 편의 함수들을 제공합니다
 */
export const AgGridUtils = {
  /**
   * 데이터를 CSV 형식으로 내보내기
   * @param gridApi - AG Grid API 객체
   * @param filename - 파일명 (선택사항)
   */
  exportToCsv: (gridApi: GridApi, filename?: string) => {
    gridApi.exportDataAsCsv({
      fileName: filename || `export_${Date.now()}.csv`,
    });
  },

  /**
   * 데이터를 Excel 형식으로 내보내기
   * @param gridApi - AG Grid API 객체
   * @param filename - 파일명 (선택사항)
   */
  exportToExcel: (gridApi: GridApi, filename?: string) => {
    gridApi.exportDataAsExcel({
      fileName: filename || `export_${Date.now()}.xlsx`,
    });
  },

  /**
   * 선택된 행들 가져오기
   * @param gridApi - AG Grid API 객체
   * @returns 선택된 행 데이터 배열
   */
  getSelectedRows: (gridApi: GridApi) => {
    return gridApi.getSelectedRows();
  },

  /**
   * 모든 행 선택
   * @param gridApi - AG Grid API 객체
   */
  selectAll: (gridApi: GridApi) => {
    gridApi.selectAll();
  },

  /**
   * 모든 행 선택 해제
   * @param gridApi - AG Grid API 객체
   */
  deselectAll: (gridApi: GridApi) => {
    gridApi.deselectAll();
  },

  /**
   * 특정 행으로 스크롤
   * @param gridApi - AG Grid API 객체
   * @param rowIndex - 스크롤할 행 인덱스
   */
  scrollToRow: (gridApi: GridApi, rowIndex: number) => {
    gridApi.ensureIndexVisible(rowIndex);
  },

  /**
   * 모든 컬럼 크기 자동 조정
   * @param gridApi - AG Grid API 객체
   */
  autoSizeAllColumns: (gridApi: GridApi) => {
    const allColumnIds = gridApi.getColumns()?.map(col => col.getColId()) || [];
    gridApi.autoSizeColumns(allColumnIds);
  },

  /**
   * 현재 필터 상태 가져오기
   * @param gridApi - AG Grid API 객체
   * @returns 필터 모델 객체
   */
  getFilterModel: (gridApi: GridApi) => {
    return gridApi.getFilterModel();
  },

  /**
   * 필터 상태 설정
   * @param gridApi - AG Grid API 객체
   * @param filterModel - 설정할 필터 모델
   */
  setFilterModel: (gridApi: GridApi, filterModel: any) => {
    gridApi.setFilterModel(filterModel);
  },

  /**
   * 현재 정렬 상태 가져오기
   * @param gridApi - AG Grid API 객체
   * @returns 컬럼 상태 배열
   */
  getSortModel: (gridApi: GridApi) => {
    return gridApi.getColumnState();
  },

  /**
   * 정렬 상태 설정
   * @param gridApi - AG Grid API 객체
   * @param sortModel - 설정할 정렬 모델
   */
  setSortModel: (gridApi: GridApi, sortModel: any[]) => {
    gridApi.applyColumnState({ state: sortModel });
  },
};

// 기본 내보내기
export default DataGrid;
