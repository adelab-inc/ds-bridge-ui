import React, { useState, useMemo } from 'react';
import { GridLayout, RowPattern, RowSlot, TitleSection, Button, Badge, Chip, Icon, IconButton, Field, Select, DataGrid, COLUMN_TYPES, Alert, Dialog, Option, OptionGroup, ToastProvider, useToast, } from '@/components';
import { ColDef } from 'ag-grid-community';

// --- Types ---
interface ConditionRow {
  id: string;
  startDate: string;
  endDate: string;
  conditionType: 'ratio' | 'fixed';
  payRate: number;
  corpPayRate: number;
  userPayRate: number;
  monthlyPremium?: number;
  totalPremium?: number;
  paymentTerm?: string;
  monthlyOp?: string;
  totalOp?: string;
  termOp?: string;
}

interface ProductGroup {
  id: string;
  productCode: string;
  productName: string;
  conditions: ConditionRow[];
}

interface PatternMonthCondition {
  label: string;
  monthlyPremium?: number;
  totalPremium?: number;
  paymentTerm?: string;
}

interface Pattern {
  id: number;
  period: string;
  monthConditions: PatternMonthCondition[];
}

// --- Mock Data Helpers ---
const createNewCondition = (): ConditionRow => ({
  id: Math.random().toString(36).substr(2, 9),
  startDate: '',
  endDate: '',
  conditionType: 'ratio',
  payRate: 0,
  corpPayRate: 0,
  userPayRate: 0,
});

const initialProductGroups: ProductGroup[] = [
  {
    id: 'pg-1',
    productCode: '',
    productName: '',
    conditions: [createNewCondition()],
  },
  {
    id: 'pg-2',
    productCode: '',
    productName: '',
    conditions: [createNewCondition(), createNewCondition()],
  },
];

const PolicyRegistrationStep1 = () => {
  const { addToast } = useToast();
  
  // States
  const [productGroups, setProductGroups] = useState<ProductGroup[]>(initialProductGroups);
  const [selectedChips, setSelectedChips] = useState<string[]>([]);
  const [showContinuousPanel, setShowContinuousPanel] = useState(false);
  const [isProductPopupOpen, setIsProductPopupOpen] = useState(false);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  // Continuous Policy Settings
  const [patternCount, setPatternCount] = useState('2');
  const [evalMonthCount, setEvalMonthCount] = useState('4');

  // Constants
  const opOptions = [
    { value: '>=', label: '>=' },
    { value: '>', label: '>' },
    { value: '=', label: '=' },
    { value: '<=', label: '<=' },
    { value: '<', label: '<' },
  ];

  // Handlers
  const toggleChip = (id: string) => {
    if (id === 'continuous') {
      setShowContinuousPanel(!showContinuousPanel);
    }
    setSelectedChips(prev => 
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const addProductGroup = () => {
    setProductGroups([...productGroups, {
      id: `pg-${Date.now()}`,
      productCode: '',
      productName: '',
      conditions: [createNewCondition()],
    }]);
  };

  const addConditionRow = (groupId: string) => {
    setProductGroups(prev => prev.map(group => 
      group.id === groupId 
        ? { ...group, conditions: [...group.conditions, createNewCondition()] }
        : group
    ));
  };

  const removeConditionRow = (groupId: string, conditionId: string) => {
    setProductGroups(prev => prev.map(group => {
      if (group.id === groupId) {
        const newConditions = group.conditions.filter(c => c.id !== conditionId);
        return { ...group, conditions: newConditions.length > 0 ? newConditions : [createNewCondition()] };
      }
      return group;
    }));
  };

  const handleSaveNext = () => {
    if (productGroups.length === 0) {
      addToast({ message: '지급 기준을 1개 이상 추가해 주세요.', type: 'error' });
      return;
    }
    const hasEmptyProduct = productGroups.some(g => !g.productCode);
    if (hasEmptyProduct) {
      addToast({ message: '상품을 선택해 주세요.', type: 'error' });
      return;
    }
    addToast({ message: '저장되었습니다. 다음 단계로 이동합니다.', type: 'success' });
  };

  // Continuous Patterns Calculation
  const patterns = useMemo(() => {
    const pCount = parseInt(patternCount);
    const mCount = parseInt(evalMonthCount);
    const result: Pattern[] = [];
    
    for (let i = 1; i <= pCount; i++) {
      const monthConditions: PatternMonthCondition[] = [];
      for (let j = mCount - 1; j >= 0; j--) {
        const label = j === 0 ? '현재 월 조건' : `${j}개월 전 조건`;
        monthConditions.push({ label });
      }
      result.push({
        id: i,
        period: `2026-0${4+i}-01 ~ 2026-0${4+i}-30`,
        monthConditions
      });
    }
    return result;
  }, [patternCount, evalMonthCount]);

  return (
    <div className="bg-canvas p-8">
      <GridLayout type="A">
        <div className="flex flex-col gap-6">
          {/* Title Section */}
          <TitleSection 
            title="시책지급기준 등록" 
            menu2="원수사 지급 기준" 
            menu3="시책 지급 기준" 
            menu4="시책지급기준 등록"
            showBreadcrumb={true}
            favorite={false}
            onFavoriteChange={() => {}}
          />

          {/* Process Indicator */}
          <div className="bg-surface rounded-xl border border-default p-4 flex items-center justify-center gap-4">
            <div className="flex items-center gap-2 text-secondary">
              <Badge type="count" label={<Icon name="check" size={16} />} appearance="solid" />
              <span className="text-sm font-medium">기본 정보 등록</span>
            </div>
            <Icon name="chevron-right" size={16} className="text-tertiary" />
            <div className="flex items-center gap-2 text-accent">
              <Badge type="count" label="2" appearance="solid" />
              <span className="text-sm font-bold">Step1 지급기준</span>
            </div>
            <Icon name="chevron-right" size={16} className="text-tertiary" />
            <div className="flex items-center gap-2 text-tertiary">
              <Badge type="count" label="3" appearance="subtle" />
              <span className="text-sm font-medium">Step2 대상조직</span>
            </div>
            <Icon name="chevron-right" size={16} className="text-tertiary" />
            <div className="flex items-center gap-2 text-tertiary">
              <Badge type="count" label="4" appearance="subtle" />
              <span className="text-sm font-medium">Step4 상세조건</span>
            </div>
          </div>

          {/* 영역1: 행 기준 선택 */}
          <div className="bg-surface rounded-xl border border-default shadow-sm p-6">
            <div className="flex justify-between items-start mb-4">
              <p className="text-sm text-secondary">※ 상품코드와 업적기간은 기본 고정 항목으로 항상 포함됩니다.</p>
              <p className="text-xs text-tertiary">선택한 항목이 지급 기준 그리드 좌측 컬럼으로 추가됩니다 · 복수 선택 가능</p>
            </div>
            <div className="flex gap-2">
              <Chip label="상품코드" showIcon={true} icon={<Badge type="level" level="neutral" label="고정" size="compact" />} disabled selected />
              <Chip label="업적기간" showIcon={true} icon={<Badge type="level" level="neutral" label="고정" size="compact" />} disabled selected />
              <Chip 
                label="납기구분" 
                showIcon={false} 
                selected={selectedChips.includes('term')} 
                onClick={() => toggleChip('term')} 
              />
              <Chip 
                label="연속가동" 
                showIcon={false} 
                selected={selectedChips.includes('continuous')} 
                onClick={() => toggleChip('continuous')} 
              />
              <Chip 
                label="월납보험료" 
                showIcon={false} 
                selected={selectedChips.includes('monthly')} 
                onClick={() => toggleChip('monthly')} 
              />
              <Chip 
                label="합계보험료" 
                showIcon={false} 
                selected={selectedChips.includes('total')} 
                onClick={() => toggleChip('total')} 
              />
            </div>
          </div>

          {/* 영역2: 지급 기준 그리드 */}
          <div className="bg-surface rounded-xl border border-default shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-primary">지급 기준</h2>
              <div className="flex gap-2">
                <Button buttonType="secondary" size="sm" label="+ 행 추가" onClick={() => addConditionRow(productGroups[productGroups.length - 1]?.id)} />
                <Button buttonType="primary" size="sm" label="+ 상품그룹 추가" onClick={addProductGroup} />
              </div>
            </div>

            {/* Custom Grid Implementation for Rowspan & Complex Layout */}
            <div className="border border-default rounded-lg overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-canvas border-b border-default text-secondary font-medium">
                  <tr>
                    <th className="p-3 border-r border-default w-[240px]">상품코드</th>
                    <th className="p-3 border-r border-default w-[320px]">업적기간</th>
                    {selectedChips.includes('monthly') && <th className="p-3 border-r border-default w-[180px]">월납보험료</th>}
                    {selectedChips.includes('term') && <th className="p-3 border-r border-default w-[180px]">납기구분</th>}
                    {selectedChips.includes('total') && <th className="p-3 border-r border-default w-[180px]">합계보험료</th>}
                    <th className="p-3 border-r border-default w-[120px]">비율/정액</th>
                    <th className="p-3 border-r border-default w-[120px]">지급액(%)</th>
                    <th className="p-3 border-r border-default w-[120px]">법인지급액(%)</th>
                    <th className="p-3 border-r border-default w-[120px]">사용인지급액(%)</th>
                    <th className="p-3 w-[60px]">삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {productGroups.map((group) => (
                    <React.Fragment key={group.id}>
                      {group.conditions.map((cond, idx) => (
                        <tr key={cond.id} className="border-b border-default last:border-0 hover:bg-canvas/50">
                          {idx === 0 && (
                            <td className="p-3 border-r border-default align-top bg-surface" rowSpan={group.conditions.length}>
                              <div className="flex flex-col gap-3">
                                {group.productCode ? (
                                  <div className="p-2 border border-default rounded bg-canvas">
                                    <div className="font-bold text-accent">{group.productCode}</div>
                                    <div className="text-xs text-secondary truncate">{group.productName}</div>
                                    <Button 
                                      buttonType="ghost" 
                                      size="sm" 
                                      label="변경" 
                                      className="mt-1 p-0 h-auto text-xs" 
                                      onClick={() => { setActiveGroupId(group.id); setIsProductPopupOpen(true); }} 
                                    />
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-2 py-4 border border-dashed border-default rounded">
                                    <span className="text-tertiary text-xs">상품 미선택</span>
                                    <Button 
                                      buttonType="secondary" 
                                      size="sm" 
                                      label="상품 추가" 
                                      onClick={() => { setActiveGroupId(group.id); setIsProductPopupOpen(true); }} 
                                    />
                                  </div>
                                )}
                                <Button 
                                  buttonType="ghost" 
                                  size="sm" 
                                  label="+ 기간 추가" 
                                  className="self-start p-0 h-auto text-accent" 
                                  onClick={() => addConditionRow(group.id)} 
                                />
                              </div>
                            </td>
                          )}
                          <td className="p-3 border-r border-default">
                            <div className="flex items-center gap-2">
                              <Field type="date" showLabel={false} placeholder="연도-월-일" className="flex-1" />
                              <span className="text-tertiary">~</span>
                              <Field type="date" showLabel={false} placeholder="연도-월-일" className="flex-1" />
                              <IconButton 
                                iconButtonType="ghost-destructive" 
                                size="sm" 
                                iconOnly={<Icon name="delete" size={16} />} 
                                aria-label="기간 삭제" 
                                onClick={() => removeConditionRow(group.id, cond.id)}
                              />
                            </div>
                          </td>
                          {selectedChips.includes('monthly') && (
                            <td className="p-3 border-r border-default">
                              <div className="flex gap-1">
                                <Select options={opOptions} defaultValue=">=" showLabel={false} className="w-20" />
                                <Field type="number" showLabel={false} className="flex-1" />
                              </div>
                            </td>
                          )}
                          {selectedChips.includes('term') && (
                            <td className="p-3 border-r border-default">
                              <div className="flex gap-1">
                                <Select options={opOptions} defaultValue=">=" showLabel={false} className="w-20" />
                                <Field type="number" showLabel={false} className="flex-1" />
                              </div>
                            </td>
                          )}
                          {selectedChips.includes('total') && (
                            <td className="p-3 border-r border-default">
                              <div className="flex gap-1">
                                <Select options={opOptions} defaultValue=">=" showLabel={false} className="w-20" />
                                <Field type="number" showLabel={false} className="flex-1" />
                              </div>
                            </td>
                          )}
                          <td className="p-3 border-r border-default">
                            <Select 
                              options={[{value:'ratio', label:'비율'}, {value:'fixed', label:'정액'}]} 
                              defaultValue="ratio" 
                              showLabel={false} 
                            />
                          </td>
                          <td className="p-3 border-r border-default">
                            <Field type="number" showLabel={false} endIcon={<span className="text-xs text-secondary">%</span>} className="text-right" />
                          </td>
                          <td className="p-3 border-r border-default">
                            <Field type="number" showLabel={false} className="text-right" />
                          </td>
                          <td className="p-3 border-r border-default">
                            <Field type="number" showLabel={false} className="text-right" />
                          </td>
                          <td className="p-3 text-center">
                            <IconButton 
                              iconButtonType="ghost-destructive" 
                              size="sm" 
                              iconOnly={<Icon name="close" size={16} />} 
                              aria-label="행 삭제" 
                              onClick={() => removeConditionRow(group.id, cond.id)}
                            />
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 연속가동 시책 설정 패널 */}
            {showContinuousPanel && (
              <div className="mt-6">
                <Alert 
                  type="warning" 
                  title="연속가동 시책 설정" 
                  showClose={true}
                  onClose={() => setShowContinuousPanel(false)}
                  body={
                    <div className="flex flex-col gap-4">
                      <p className="text-sm">판매 · 유지를 모두 충족하는 건에만 지급하는 연속가동 시책입니다. 패턴 수 · 평가월 수에 따라 조건 항목이 자동 생성됩니다.</p>
                      <div className="flex gap-6 items-end">
                        <Select 
                          label="패턴 수" 
                          showLabel={true} 
                          options={[1,2,3,4,5,6].map(v => ({value: String(v), label: String(v)}))} 
                          value={patternCount}
                          onChange={(v) => setPatternCount(v as string)}
                          className="w-32"
                        />
                        <Select 
                          label="평가월 수" 
                          showLabel={true} 
                          options={[1,2,3,4].map(v => ({value: String(v), label: String(v)}))} 
                          value={evalMonthCount}
                          onChange={(v) => setEvalMonthCount(v as string)}
                          className="w-32"
                        />
                      </div>

                      {/* 패턴 그리드 */}
                      <div className="flex flex-col gap-4 mt-2">
                        {patterns.map((pattern) => (
                          <div key={pattern.id} className="bg-surface border border-default rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3 pb-2 border-b border-default">
                              <Badge type="count" label={pattern.id} appearance="solid" />
                              <span className="font-bold text-primary">기간: {pattern.period}</span>
                            </div>
                            <table className="w-full text-xs">
                              <thead className="text-secondary border-b border-default">
                                <tr>
                                  <th className="p-2 text-left w-[150px]">조건 구분</th>
                                  {selectedChips.includes('monthly') && <th className="p-2 text-left">월납보험료 조건</th>}
                                  {selectedChips.includes('total') && <th className="p-2 text-left">합계보험료 조건</th>}
                                  {selectedChips.includes('term') && <th className="p-2 text-left">납기구분 조건</th>}
                                </tr>
                              </thead>
                              <tbody>
                                {pattern.monthConditions.map((mc, idx) => (
                                  <tr key={idx} className="border-b border-default last:border-0">
                                    <td className="p-2 font-medium text-primary bg-canvas/30">{mc.label}</td>
                                    {selectedChips.includes('monthly') && (
                                      <td className="p-2">
                                        <div className="flex gap-1">
                                          <Select options={opOptions} defaultValue=">=" showLabel={false} size="sm" className="w-16" />
                                          <Field type="number" showLabel={false} size="sm" className="flex-1" />
                                        </div>
                                      </td>
                                    )}
                                    {selectedChips.includes('total') && (
                                      <td className="p-2">
                                        <div className="flex gap-1">
                                          <Select options={opOptions} defaultValue=">=" showLabel={false} size="sm" className="w-16" />
                                          <Field type="number" showLabel={false} size="sm" className="flex-1" />
                                        </div>
                                      </td>
                                    )}
                                    {selectedChips.includes('term') && (
                                      <td className="p-2">
                                        <div className="flex gap-1">
                                          <Select options={opOptions} defaultValue=">=" showLabel={false} size="sm" className="w-16" />
                                          <Field type="number" showLabel={false} size="sm" className="flex-1" />
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ))}
                      </div>
                    </div>
                  }
                />
              </div>
            )}
          </div>

          {/* 영역3: 하단 버튼 영역 */}
          <div className="flex justify-between items-center mt-4">
            <Button buttonType="tertiary" label="목록으로" onClick={() => {}} />
            <div className="flex gap-2">
              <Button buttonType="secondary" label="임시저장" onClick={() => addToast({ message: '임시저장되었습니다.', type: 'info' })} />
              <Button buttonType="primary" label="저장 후 다음" onClick={handleSaveNext} />
            </div>
          </div>
        </div>
      </GridLayout>

      {/* 상품 조회 팝업 */}
      <ProductSearchPopup 
        open={isProductPopupOpen} 
        onClose={() => setIsProductPopupOpen(false)} 
        onConfirm={(product) => {
          if (activeGroupId) {
            setProductGroups(prev => prev.map(g => 
              g.id === activeGroupId ? { ...g, productCode: product.code, productName: product.name } : g
            ));
          }
          setIsProductPopupOpen(false);
        }}
      />
    </div>
  );
};

// --- Product Search Popup Component ---
const ProductSearchPopup = ({ open, onClose, onConfirm }: { open: boolean; onClose: () => void; onConfirm: (p: any) => void }) => {
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<any[]>([]);

  const mockProducts = [
    { corp: '삼성생명', mainCode: 'P001', code: 'S001', name: '(무)삼성 통합 유니버설 종신보험', startDate: '2024-01-01', endDate: '2099-12-31' },
    { corp: '한화생명', mainCode: 'P002', code: 'H001', name: '(무)한화생명 시그니처 암보험', startDate: '2024-02-01', endDate: '2099-12-31' },
    { corp: '현대해상', mainCode: 'P003', code: 'M001', name: '현대해상 굿앤굿어린이종합보험', startDate: '2024-03-01', endDate: '2099-12-31' },
  ];

  const handleSearch = () => {
    setSearchResults(mockProducts);
  };

  const columnDefs: ColDef[] = [
    { field: 'corp', headerName: '보험사', width: 120 },
    { field: 'mainCode', headerName: '대표상품코드', width: 120, cellClass: 'text-center' },
    { field: 'code', headerName: '상품코드', width: 120, cellClass: 'text-center' },
    { field: 'name', headerName: '상품명', flex: 1 },
    { field: 'startDate', headerName: '판매시작일', ...COLUMN_TYPES.dateColumn, width: 120 },
    { field: 'endDate', headerName: '판매종료일', ...COLUMN_TYPES.dateColumn, width: 120 },
  ];

  const selectedColumnDefs: ColDef[] = [
    ...columnDefs,
    {
      headerName: '취소',
      width: 60,
      cellRenderer: (params: any) => (
        <IconButton 
          iconButtonType="ghost-destructive" 
          size="sm" 
          iconOnly={<Icon name="close" size={16} />} 
          aria-label="취소" 
          onClick={() => setSelectedProducts(prev => prev.filter(p => p.code !== params.data.code))}
        />
      )
    }
  ];

  return (
    <Dialog open={open} onClose={onClose} size="lg">
      <Dialog.Header title="상품 조회 및 선택" />
      <Dialog.Body>
        <div className="flex flex-col gap-6">
          {/* 검색 조건 */}
          <div className="bg-canvas p-4 rounded-lg grid grid-cols-6 gap-4 items-end">
            <Select label="보험사" placeholder="전체" options={[]} showLabel={true} />
            <Field label="상품코드" placeholder="상품코드 입력" showLabel={true} />
            <Field label="상품명" placeholder="상품명 입력" showLabel={true} />
            <Field label="상품명 일부" placeholder="일부 입력" showLabel={true} />
            <Select label="판매여부" placeholder="전체" options={[{value:'all', label:'전체'}, {value:'y', label:'판매'}, {value:'n', label:'판매중지'}]} showLabel={true} />
            <Button buttonType="primary" label="조회" onClick={handleSearch} className="w-full" />
          </div>

          {/* 상품 조회 결과 */}
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-primary">상품 조회 결과</h3>
            <DataGrid 
              rowData={searchResults} 
              columnDefs={columnDefs} 
              height={240} 
              rowSelection={{ mode: 'multiRow', checkboxes: true }}
              onSelectionChanged={(event) => setSelectedProducts(event.api.getSelectedRows())}
              noRowsMessage="조회 조건을 입력하고 조회 버튼을 클릭하세요."
            />
          </div>

          {/* 선택된 상품 목록 */}
          <div className="flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-semibold text-primary">선택된 상품 목록</h3>
              <Button buttonType="ghost" size="sm" label="전체 취소" onClick={() => setSelectedProducts([])} />
            </div>
            <DataGrid 
              rowData={selectedProducts} 
              columnDefs={selectedColumnDefs} 
              height={180} 
              rowSelection={{ mode: 'multiRow', checkboxes: true }}
              noRowsMessage="선택된 상품이 없습니다."
            />
          </div>
        </div>
      </Dialog.Body>
      <Dialog.Footer>
        <div className="flex justify-between w-full">
          <Button buttonType="tertiary" label="선택된 상품 수정" onClick={() => {}} />
          <div className="flex gap-2">
            <Button buttonType="tertiary" label="취소" onClick={onClose} />
            <Button 
              buttonType="primary" 
              label="최종 확인" 
              onClick={() => selectedProducts.length > 0 && onConfirm(selectedProducts[0])} 
            />
          </div>
        </div>
      </Dialog.Footer>
    </Dialog>
  );
};

export default () => (
  <ToastProvider>
    <PolicyRegistrationStep1 />
  </ToastProvider>
);