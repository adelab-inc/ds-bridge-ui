import React, { useState } from 'react';
import { GridLayout, RowPattern, RowSlot, TitleSection, FilterBar, Field, Select, Button, DataGrid, COLUMN_TYPES, Icon, Checkbox, Option, OptionGroup, Badge } from '@/components';
import { ColDef } from 'ag-grid-community';

const PerformanceStatus = () => {
  // 검색 조건 상태
  const [partner, setPartner] = useState('life');
  const [calcMonth, setCalcMonth] = useState('2025-05');
  const [roundType, setRoundType] = useState('fixed');
  const [statusType, setStatusType] = useState('all');
  const [orgName, setOrgName] = useState('');
  const [tfaName, setTfaName] = useState('');
  const [includeTfa, setIncludeTfa] = useState<'unchecked' | 'checked'>('unchecked');

  // 그리드 데이터 상태 (엔티티당 3행 평탄화: 모집고/유지고/%)
  const [rowData] = useState([
    // 전략채널본부
    { id: '1-1', depth: 0, org: '전략채널본부', type: '채널', metricIndex: 0, metric: '모집고', m2: 314512, m3: 280175, m4: 450357, m5: 393900, m6: 371959, m7: 297954, m8: 33251, m9: 296609, m10: 288863, m11: 320748, m12: 236268, m13: 358335, m14: 190519, m15: 365266, m16: 274148, m17: 198291, m18: 152639, m19: 153229, m20: 257749, m21: 179725, m22: 197581, m23: 126774, m24: 158729, m25: 196177, acc4: 1045043, acc7: 2108857, acc13: 3948930, acc19: 5129733, total: 6399758 },
    { id: '1-2', depth: 0, org: '전략채널본부', type: '채널', metricIndex: 1, metric: '유지고', m2: 303331, m3: 256658, m4: 434075, m5: 358906, m6: 334346, m7: 251286, m8: 294885, m9: 253903, m10: 225925, m11: 261911, m12: 192714, m13: 316889, m14: 159021, m15: 316950, m16: 228807, m17: 159683, m18: 104193, m19: 121338, m20: 199235, m21: 136589, m22: 160157, m23: 85035, m24: 115560, m25: 141669, acc4: 994064, acc7: 1938602, acc13: 3484829, acc19: 4453482, total: 5413055 },
    { id: '1-3', depth: 0, org: '전략채널본부', type: '채널', metricIndex: 2, metric: '%', m2: 96.4, m3: 91.6, m4: 96.4, m5: 91.1, m6: 89.9, m7: 84.3, m8: 886.8, m9: 85.6, m10: 78.2, m11: 81.7, m12: 81.6, m13: 88.4, m14: 83.5, m15: 86.8, m16: 83.5, m17: 80.5, m18: 68.3, m19: 79.2, m20: 77.3, m21: 76.0, m22: 81.1, m23: 67.1, m24: 72.8, m25: 72.2, acc4: 95.1, acc7: 91.9, acc13: 88.2, acc19: 86.8, total: 84.6 },
    // 전략채널지원파트
    { id: '2-1', depth: 1, org: '전략채널지원파트', type: '본부', metricIndex: 0, metric: '모집고', m2: 314512, m3: 280175, m4: 450357, m5: 393900, m6: 371959, m7: 297954, m8: 33251, m9: 296609, m10: 288863, m11: 320748, m12: 236268, m13: 358335, m14: 190519, m15: 365266, m16: 274148, m17: 198291, m18: 152639, m19: 153229, m20: 257749, m21: 179725, m22: 197581, m23: 126774, m24: 158729, m25: 196177, acc4: 1045043, acc7: 2108857, acc13: 3948930, acc19: 5129733, total: 6399758 },
    { id: '2-2', depth: 1, org: '전략채널지원파트', type: '본부', metricIndex: 1, metric: '유지고', m2: 303331, m3: 256658, m4: 434075, m5: 358906, m6: 334346, m7: 251286, m8: 294885, m9: 253903, m10: 225925, m11: 261911, m12: 192714, m13: 316889, m14: 159021, m15: 316950, m16: 228807, m17: 159683, m18: 104193, m19: 121338, m20: 199235, m21: 136589, m22: 160157, m23: 85035, m24: 115560, m25: 141669, acc4: 994064, acc7: 1938602, acc13: 3484829, acc19: 4453482, total: 5413055 },
    { id: '2-3', depth: 1, org: '전략채널지원파트', type: '본부', metricIndex: 2, metric: '%', m2: 96.4, m3: 91.6, m4: 96.4, m5: 91.1, m6: 89.9, m7: 84.3, m8: 886.8, m9: 85.6, m10: 78.2, m11: 81.7, m12: 81.6, m13: 88.4, m14: 83.5, m15: 86.8, m16: 83.5, m17: 80.5, m18: 68.3, m19: 79.2, m20: 77.3, m21: 76.0, m22: 81.1, m23: 67.1, m24: 72.8, m25: 72.2, acc4: 95.1, acc7: 91.9, acc13: 88.2, acc19: 86.8, total: 84.6 },
    // 1사업부
    { id: '3-1', depth: 2, org: '1사업부', type: '권역단', metricIndex: 0, metric: '모집고', m2: 117954, m3: 124455, m4: 187514, m5: 147502, m6: 182344, m7: 141501, m8: 170179, m9: 130261, m10: 132160, m11: 103330, m12: 81464, m13: 93189, m14: 52445, m15: 80397, m16: 47700, m17: 45013, m18: 47275, m19: 45402, m20: 71809, m21: 34013, m22: 32844, m23: 36196, m24: 70487, m25: 79157, acc4: 429924, acc7: 901271, acc13: 1611855, acc19: 1884684, total: 2254592 },
    { id: '3-2', depth: 2, org: '1사업부', type: '권역단', metricIndex: 1, metric: '유지고', m2: 116459, m3: 109669, m4: 182153, m5: 137732, m6: 160867, m7: 112893, m8: 137087, m9: 105846, m10: 89762, m11: 65018, m12: 66590, m13: 85232, m14: 40352, m15: 65426, m16: 37100, m17: 38456, m18: 22027, m19: 38553, m20: 58394, m21: 22725, m22: 23464, m23: 22934, m24: 54610, m25: 50824, acc4: 408282, acc7: 819744, acc13: 1369310, acc19: 1572670, total: 1844174 },
    { id: '3-3', depth: 2, org: '1사업부', type: '권역단', metricIndex: 2, metric: '%', m2: 98.7, m3: 88.1, m4: 97.1, m5: 93.4, m6: 88.2, m7: 79.8, m8: 80.6, m9: 81.3, m10: 67.9, m11: 62.9, m12: 81.7, m13: 91.5, m14: 76.9, m15: 81.4, m16: 77.8, m17: 85.4, m18: 46.6, m19: 84.9, m20: 81.3, m21: 66.8, m22: 71.4, m23: 63.4, m24: 77.5, m25: 64.2, acc4: 95.0, acc7: 91.0, acc13: 85.0, acc19: 83.4, total: 81.8 },
    // 에이스타지사
    { id: '4-1', depth: 3, org: '에이스타지사', type: '사업단', metricIndex: 0, metric: '모집고', m2: 377, m3: 537, m4: 974, m5: 360, m6: 503, m7: 418, m8: 554, m9: 554, m10: 757, m11: 581, m12: 156, m13: 47, m14: 213, m15: 1043, m16: 165, m17: 275, m18: 533, m19: 1154, m20: 3458, m21: 261, m22: 231, m23: 744, m24: 489, m25: 1463, acc4: 1888, acc7: 3168, acc13: 5817, acc19: 8046, total: 15845 },
    { id: '4-2', depth: 3, org: '에이스타지사', type: '사업단', metricIndex: 1, metric: '유지고', m2: 377, m3: 537, m4: 806, m5: 360, m6: 503, m7: 418, m8: 554, m9: 554, m10: 629, m11: 294, m12: 156, m13: 47, m14: 213, m15: 1043, m16: 165, m17: 275, m18: 533, m19: 644, m20: 3458, m21: 261, m22: 231, m23: 744, m24: 461, m25: 1380, acc4: 1720, acc7: 3000, acc13: 5234, acc19: 7464, total: 14642 },
    { id: '4-3', depth: 3, org: '에이스타지사', type: '사업단', metricIndex: 2, metric: '%', m2: 100.0, m3: 100.0, m4: 82.8, m5: 100.0, m6: 100.0, m7: 100.0, m8: 100.0, m9: 100.0, m10: 83.1, m11: 50.6, m12: 100.0, m13: 100.0, m14: 100.0, m15: 100.0, m16: 100.0, m17: 100.0, m18: 100.0, m19: 55.8, m20: 100.0, m21: 100.0, m22: 100.0, m23: 100.0, m24: 94.3, m25: 94.3, acc4: 91.1, acc7: 94.7, acc13: 90.0, acc19: 92.8, total: 92.4 },
    // 소율지사
    { id: '5-1', depth: 3, org: '소율지사', type: '사업단', metricIndex: 0, metric: '모집고', m2: 17, m3: 0, m4: 640, m5: 1019, m6: 757, m7: 182, m8: 4417, m9: 310, m10: 668, m11: 53, m12: 778, m13: 2352, m14: 1039, m15: 378, m16: 1390, m17: 10352, m18: 1294, m19: 11799, m20: 2031, m21: 996, m22: 573, m23: 1094, m24: 30987, m25: 3389, acc4: 657, acc7: 2614, acc13: 11192, acc19: 25645, total: 76514 },
    { id: '5-2', depth: 3, org: '소율지사', type: '사업단', metricIndex: 1, metric: '유지고', m2: 17, m3: 0, m4: 640, m5: 1019, m6: 757, m7: 182, m8: 4417, m9: 310, m10: 668, m11: 53, m12: 778, m13: 2149, m14: 905, m15: 281, m16: 1390, m17: 9773, m18: 758, m19: 10811, m20: 2031, m21: 996, m22: 557, m23: 1094, m24: 30800, m25: 2845, acc4: 657, acc7: 2614, acc13: 10990, acc19: 24097, total: 73230 },
    { id: '5-3', depth: 3, org: '소율지사', type: '사업단', metricIndex: 2, metric: '%', m2: 100.0, m3: 0.0, m4: 100.0, m5: 100.0, m6: 100.0, m7: 100.0, m8: 100.0, m9: 100.0, m10: 100.0, m11: 100.0, m12: 100.0, m13: 91.4, m14: 87.1, m15: 74.3, m16: 100.0, m17: 94.4, m18: 58.6, m19: 91.6, m20: 100.0, m21: 100.0, m22: 97.2, m23: 100.0, m24: 99.4, m25: 83.9, acc4: 100.0, acc7: 100.0, acc13: 98.2, acc19: 94.0, total: 95.7 },
  ]);
>>>>>>> REPLACE
<<<<<<< SEARCH
    {
      headerName: '월별 추적 (회차)',
      children: [
        { field: 'm2', headerName: '2회(202502)', width: 120, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm3', headerName: '3회(202501)', width: 120, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm15', headerName: '15회(202401)', width: 120, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
      ]
    },
    {
      headerName: '기간별 누적 합산',
      children: [
        { field: 'acc4', headerName: '2~4회(누적)', width: 130, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'acc7', headerName: '2~7회(누적)', width: 130, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'total', headerName: '2~25회(최종)', width: 140, valueFormatter: matrixValueFormatter, cellClass: 'text-right font-semibold' },
      ]
    }
  ];
=======
    {
      headerName: '월별 추적 (회차)',
      children: [
        { field: 'm2', headerName: '2회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm3', headerName: '3회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm4', headerName: '4회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm5', headerName: '5회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm6', headerName: '6회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm7', headerName: '7회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm8', headerName: '8회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm9', headerName: '9회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm10', headerName: '10회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm11', headerName: '11회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm12', headerName: '12회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm13', headerName: '13회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm14', headerName: '14회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm15', headerName: '15회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm16', headerName: '16회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm17', headerName: '17회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm18', headerName: '18회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm19', headerName: '19회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm20', headerName: '20회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm21', headerName: '21회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm22', headerName: '22회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm23', headerName: '23회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm24', headerName: '24회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm25', headerName: '25회', width: 90, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
      ]
    },
    {
      headerName: '기간별 누적 합산',
      children: [
        { field: 'acc4', headerName: '2~4회', width: 110, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'acc7', headerName: '2~7회', width: 110, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'acc13', headerName: '2~13회', width: 110, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'acc19', headerName: '2~19회', width: 110, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'total', headerName: '2~25회(최종)', width: 130, valueFormatter: matrixValueFormatter, cellClass: 'text-right font-semibold' },
      ]
    }
  ];

  // RowSpan 및 스타일 헬퍼
  const spanThree = (params: any) => (params.data?.metricIndex === 0 ? 3 : 1);
  const hideIfNotFirst = (params: any) => (params.data?.metricIndex !== 0 ? { display: 'none' } : undefined);

  // 계층형 렌더러 (Depth에 따른 들여쓰기)
  const LabelCellRenderer = (params: any) => {
    const depth = params.data?.depth || 0;
    return (
      <div className="flex items-center h-full" style={{ paddingLeft: `${depth * 16}px` }}>
        {depth < 3 && <Icon name={depth === 0 ? 'folder-fill' : 'folder'} size={16} className="mr-2 text-secondary" />}
        {depth >= 3 && <Icon name="widgets" size={16} className="mr-2 text-tertiary" />}
        <span className="text-primary font-medium">{params.value}</span>
      </div>
    );
  };

  // 매트릭스 값 포맷터 (모집고/유지고는 통화, %는 퍼센트)
  const matrixValueFormatter = (params: any) => {
    if (params.value == null) return '-';
    if (params.data?.metric === '%') return params.value.toFixed(1) + '%';
    return params.value.toLocaleString();
  };

  const columnDefs: (ColDef | any)[] = [
    { 
      field: 'org', 
      headerName: '소속', 
      width: 240, 
      cellRenderer: LabelCellRenderer,
      rowSpan: spanThree,
      cellStyle: hideIfNotFirst,
      sortable: false,
      filter: false
    },
    { 
      field: 'type', 
      headerName: '구분', 
      width: 100,
      rowSpan: spanThree,
      cellStyle: { ...hideIfNotFirst, textAlign: 'center' },
      sortable: false,
      filter: false
    },
    { 
      field: 'metric', 
      headerName: '회차', 
      width: 100,
      cellStyle: { textAlign: 'center' },
      cellRenderer: (params: any) => (
        <Badge 
          type="level" 
          level={params.value === '%' ? 'primary' : 'neutral'} 
          appearance="subtle" 
          label={params.value} 
        />
      )
    },
    {
      headerName: '월별 추적 (회차)',
      children: [
        { field: 'm2', headerName: '2회(202502)', width: 120, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm3', headerName: '3회(202501)', width: 120, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'm15', headerName: '15회(202401)', width: 120, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
      ]
    },
    {
      headerName: '기간별 누적 합산',
      children: [
        { field: 'acc4', headerName: '2~4회(누적)', width: 130, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'acc7', headerName: '2~7회(누적)', width: 130, valueFormatter: matrixValueFormatter, cellClass: 'text-right' },
        { field: 'total', headerName: '2~25회(최종)', width: 140, valueFormatter: matrixValueFormatter, cellClass: 'text-right font-semibold' },
      ]
    }
  ];

  return (
    <div className="bg-canvas p-8">
      <GridLayout type="A">
        <div className="w-full min-w-0">
          <TitleSection 
            title="조직회차별 유지율 현황" 
            menu2="실적관리" 
            menu3="실적현황" 
            showBreadcrumb={true} 
            favorite={false} 
            onFavoriteChange={() => {}}
          >
            <Button buttonType="tertiary" size="sm" label="이미지시스템" showEndIcon={true} endIcon={<Icon name="external" size={16} />} />
            <Button buttonType="secondary" size="sm" label="엑셀 다운로드" startIcon={<Icon name="add" size={16} />} showStartIcon={true} />
          </TitleSection>

          <div className="bg-surface rounded-xl border border-default shadow-sm p-6 mt-6">
            <RowPattern pattern="RP-1">
              <RowSlot slot="filter">
                <FilterBar 
                  mode="compact" 
                  onReset={() => {}} 
                  onSearch={() => {}} 
                  actionSpan={2}
                >
                  {/* 1행 */}
                  <div className="col-span-3">
                    <Select 
                      label="제휴사" 
                      showLabel={true}
                      value={partner} 
                      onChange={(v) => setPartner(v as string)}
                      options={[
                        { value: 'life', label: '생보' },
                        { value: 'non-life', label: '손보' },
                        { value: 'all', label: '전체' }
                      ]} 
                    />
                  </div>
                  <div className="col-span-2">
                    <Field 
                      type="date" 
                      label="산출월" 
                      showLabel={true}
                      value={calcMonth} 
                      onChange={(e) => setCalcMonth(e.target.value)} 
                    />
                  </div>
                  <div className="col-span-3">
                    <div className="relative">
                      <Select 
                        label="회차구분" 
                        showLabel={true}
                        value={roundType} 
                        onChange={(v) => setRoundType(v as string)}
                        options={[
                          { value: 'fixed', label: '환산_확정' },
                          { value: 'temp', label: '환산_가산' }
                        ]} 
                        selectProps={{ className: "bg-[#fae6e6]/30" }} // 필수 강조를 위한 연분홍 배경 처리
                      />
                    </div>
                  </div>
                  <div className="col-span-2">
                    <Select 
                      label="위해촉구분" 
                      showLabel={true}
                      value={statusType} 
                      onChange={(v) => setStatusType(v as string)}
                      options={[
                        { value: 'all', label: '전체' },
                        { value: 'active', label: '위촉' },
                        { value: 'inactive', label: '해촉' }
                      ]} 
                    />
                  </div>

                  {/* 2행 */}
                  <div className="col-span-4">
                    <Field 
                      label="소속" 
                      showLabel={true}
                      placeholder="조직 검색"
                      value={orgName}
                      onChange={(e) => setOrgName(e.target.value)}
                      showEndIcon={true}
                      endIcon={<Icon name="search" size={20} />}
                      onEndIconClick={() => {}}
                    />
                  </div>
                  <div className="col-span-4">
                    <Field 
                      label="TFA명" 
                      showLabel={true}
                      placeholder="설계사 검색"
                      value={tfaName}
                      onChange={(e) => setTfaName(e.target.value)}
                      showEndIcon={true}
                      endIcon={<Icon name="search" size={20} />}
                      onEndIconClick={() => {}}
                    />
                  </div>
                  <div className="col-span-2 flex items-end pb-2">
                    <OptionGroup orientation="horizontal">
                      <Option label="TFA포함">
                        <Checkbox 
                          value={includeTfa} 
                          onChange={() => setIncludeTfa(includeTfa === 'checked' ? 'unchecked' : 'checked')} 
                        />
                      </Option>
                    </OptionGroup>
                  </div>
                </FilterBar>
              </RowSlot>

              <RowSlot slot="actions">
                <div className="flex justify-between items-center w-full">
                  <div className="flex items-center gap-2">
                    <Badge type="count" label={rowData.length} />
                    <span className="text-sm text-secondary font-medium">건의 데이터가 조회되었습니다.</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button buttonType="tertiary" size="sm" label="전체닫기" onClick={() => {}} />
                    <Button buttonType="tertiary" size="sm" label="사업부별확장" onClick={() => {}} />
                    <Button buttonType="tertiary" size="sm" label="지사레벨확장" onClick={() => {}} />
                    <Button buttonType="tertiary" size="sm" label="사업단레벨확장" onClick={() => {}} />
                    <Button buttonType="tertiary" size="sm" label="지점레벨확장" onClick={() => {}} />
                    <Button 
                      buttonType="tertiary" 
                      size="sm" 
                      label="TFA레벨확장" 
                      interaction={includeTfa === 'checked' ? 'default' : 'disabled'}
                      onClick={() => {}} 
                    />
                    <Button buttonType="secondary" size="sm" label="전체확장" onClick={() => {}} />
                  </div>
                </div>
              </RowSlot>

              <RowSlot slot="grid">
                <div className="border border-default rounded-lg overflow-hidden">
                  <DataGrid 
                    rowData={rowData} 
                    columnDefs={columnDefs} 
                    height={600}
                    suppressRowTransform={true}
                    defaultColDef={{
                      sortable: false,
                      filter: false,
                      resizable: true
                    }}
                    pagination
                    paginationPageSize={30}
                  />
                </div>
              </RowSlot>
            </RowPattern>
          </div>
        </div>
      </GridLayout>
    </div>
  );
};

export default PerformanceStatus;