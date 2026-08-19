import React, { useState } from 'react';
import { GridLayout, RowPattern, RowSlot, TitleSection, Button, Field, Select, Tab, Badge, Icon, IconButton, Radio, Option, OptionGroup, Divider, Tag, DataGrid, COLUMN_TYPES, Alert, Segment, Checkbox, Drawer, Dialog } from '@/components';
import { ColDef } from 'ag-grid-community';

const PushSend = () => {
  // --- State ---
  const [message, setMessage] = useState('');
  const [sendType, setSendType] = useState('SMS');
  const [senderNumber, setSenderNumber] = useState('0220095355');
  const [sendTime, setSendTime] = useState('immediate');
  const [mainTab, setMainTab] = useState('sample');
  const [subTab, setSubTab] = useState('short');
  const [category, setCategory] = useState('issue');
  const [pushType, setPushType] = useState('notice');
  const [showAllRecipients, setShowAllRecipients] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [recipients, setRecipients] = useState([
    { id: 1, name: '황승목', phone: '010-2764-0064' },
    { id: 2, name: '홍길동', phone: '010-9999-0064' },
    { id: 3, name: '윤창혁', phone: '010-5252-0060' },
  ]);

  // --- Mock Data ---
  const templates = [
    { id: 1, title: '초복더위', body: '8월까지 폭염이 계속된다고 해요. 더 지치기전에 보양식으로 기력충전하세요! 남은여름도 화이팅', byte: 90, type: 'short' },
    { id: 2, title: '열정적인 7월', body: '여름에 피는 붉은 장미만큼 정열적인 것이 있을까요? 여름의 절정인 7월, 활기찬 한 달 보내세요', byte: 90, type: 'short' },
    { id: 3, title: '7월 힘내세요', body: '본격적인 여름으로 돌입하는 7월입니다. 무더위를 견디기 위해선 체력이 필요합니다. 힘내세요', byte: 88, type: 'short' },
    { id: 4, title: '7월 여름비', body: '소나기처럼 여우비처럼 내리는 여름비에 한여름 열기가 한층 가시길 바래봅니다. 덥지만 화이팅', byte: 89, type: 'short' },
    { id: 5, title: '장문 안내 1', body: '[보플] 안녕하세요 고객님. 무더운 여름철 건강관리에 유의하시기 바랍니다. 장문 메시지는 최대 2000바이트까지 작성이 가능하며, 풍부한 내용을 담아 고객님께 진심을 전달할 수 있습니다. 이번 하반기에는 더욱 알찬 혜택으로 찾아뵙겠습니다. 감사합니다.', byte: 245, type: 'long' },
    { id: 6, title: '장문 안내 2', body: '[이벤트 알림] 7월 한 달간 진행되는 특별 프로모션 안내입니다. 본 메시지는 장문(LMS)으로 발송되며, 상세 내용은 아래와 같습니다. 1. 신규 가입 시 혜택 증정 2. 기존 고객 대상 포인트 적립 3. 지인 추천 시 추가 리워드 제공. 지금 바로 앱에서 확인하세요!', byte: 312, type: 'long' },
    { id: 13, title: '여름 인사 1', body: '본격적인 여름의 시작입니다. 무더운 날씨에 지치기 쉬운 계절이지만, 시원한 나무 그늘 아래서 잠시 휴식을 취하며 여유를 가져보시는 건 어떨까요? 건강하고 활기찬 여름 보내시길 진심으로 기원합니다.', byte: 185, type: 'long' },
    { id: 14, title: '여름 인사 2', body: '뜨거운 태양이 내리쬐는 7월입니다. 무더위 속에서도 항상 웃음 잃지 마시고, 시원한 수박 한 조각과 함께 행복한 시간 보내시길 바랍니다. 남은 한 달도 건강 관리 잘 하시고 좋은 일만 가득하세요!', byte: 192, type: 'long' },
    { id: 15, title: '여름 인사 3', body: '여름 휴가 계획은 세우셨나요? 일상의 단조로움에서 벗어나 새로운 에너지를 충전하는 소중한 시간 되시길 바랍니다. 덥지만 마음만은 시원한 여름날 되시길 바라며, 항상 고객님의 행복을 응원하겠습니다.', byte: 210, type: 'long' },
    { id: 16, title: '여름 인사 4', body: '초록이 짙어가는 여름입니다. 싱그러운 자연의 기운을 듬뿍 받으시어 지치지 않는 열정으로 가득한 7월 보내시길 바랍니다. 무더위에 건강 유의하시고, 항상 시원하고 쾌적한 하루하루 되세요.', byte: 198, type: 'long' },
    { id: 17, title: '여름 인사 5', body: '바다의 파도 소리가 그리워지는 계절입니다. 무더운 일상이지만 마음속에 시원한 바다를 품고 여유롭게 보내시길 바랍니다. 건강한 여름 나기를 위해 충분한 수분 섭취 잊지 마시고, 오늘도 행복하세요.', byte: 205, type: 'long' },
    { id: 18, title: '여름 인사 6', body: '여름비가 내리는 오후입니다. 빗소리와 함께 한낮의 열기가 식어가는 것처럼, 고객님의 걱정도 시원하게 씻겨 내려가길 바랍니다. 남은 하루도 평안하고 시원하게 마무리하시길 기원합니다. 감사합니다.', byte: 190, type: 'long' },
    { id: 7, title: '7월 초록', body: '초록의 싱그러움이 함께하는 7월 여름입니다. 당신만의 열정으로 더위도 즐기는 한 달 보내시길~', byte: 90, type: 'short' },
    { id: 8, title: '7월 시작', body: '7월의 시작! 당신의 선택에 달려있습니다. 하루하루 행복을 만들어가는 여러분이 되시길 바래요~', byte: 90, type: 'short' },
    { id: 9, title: '7월 장마시즌', body: '여름 더위를 물리칠 장마시즌이 돌아왔습니다. 물부족인 요즘 기우제 대신 비를 기원해봅니다.', byte: 90, type: 'short' },
    { id: 10, title: '새로운 7월', body: '올해 상반기를 넘긴 7월은 또다시 새롭게 시작해보세요~ 희망찬 하반기의 시작입니다. 화이팅!', byte: 90, type: 'short' },
    { id: 11, title: '행운의 7월', body: '어느새 달력을 넘겨보니 7월 입니다. 럭키세븐인 이 달 행운 가득한 한달 보내시길 바랍니다^^', byte: 90, type: 'short' },
    { id: 12, title: '뜨거운 7월', body: '뜨거운 여름 태양의 달 7월! 당신의 열정으로 더위를 이겨내는 한 달 보내시길 바랍니다★', byte: 90, type: 'short' },
  ];

  const categories = [
    { id: 'issue', label: '이슈', sub: ['전체', '금리'] },
    { id: 'customer', label: '고객', sub: ['전체', '만남인사', '안부인사', '거절처리', '감사인사', '전/이직', '계약관리'] },
    { id: 'season', label: '계절', sub: ['전체', '봄', '여름', '가을', '겨울'] },
    { id: 'weather', label: '날씨', sub: ['전체', '맑음', '비', '눈', '오늘'] },
    { id: 'condolence', label: '근조', sub: ['전체', '근조'] },
    { id: 'congratulation', label: '축하', sub: ['전체', '생일', '결혼', '출산', '개업', '입학', '졸업', '승진'] },
    { id: 'emotion', label: '감성', sub: ['전체', '유머러스', '엽기발랄', '여자감성'] },
    { id: 'anniversary', label: '기념', sub: ['전체', '신년', '복날', '사탕', '쵸코', '어버이', '휴가', '추석', '성탄', '연말'] },
    { id: 'product', label: '상품', sub: ['전체', '상품안내'] },
    { id: 'healthcare', label: '헬스케어', sub: ['전체', '헬스케어 소개', '사례 소개', '시즌'] },
  ];

  const [selectedSub, setSelectedSub] = useState('전체');

  // --- Handlers ---
  const handleTemplateClick = (text: string) => {
    setMessage(text);
  };

  const addRecipient = (newRecipients: any[]) => {
    setRecipients([...recipients, ...newRecipients]);
    setIsSearchOpen(false);
  };

  const toggleDeleteMode = () => {
    if (isDeleteMode) {
      if (selectedIds.size > 0) {
        setRecipients(recipients.filter((r) => !selectedIds.has(r.id)));
        setSelectedIds(new Set());
      }
      setIsDeleteMode(false);
    } else {
      setIsDeleteMode(true);
    }
  };

  const handleCheckChange = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // --- Recipient Grid Config ---
  const columnDefs: ColDef[] = [
    ...(isDeleteMode
      ? [
          {
            headerName: '',
            width: 50,
            cellRenderer: (params: any) => (
              <div className="flex items-center justify-center h-full">
                <Checkbox
                  value={selectedIds.has(params.data.id) ? 'checked' : 'unchecked'}
                  onChange={() => handleCheckChange(params.data.id)}
                />
              </div>
            ),
          },
        ]
      : []),
    {
      headerName: '성명',
      field: 'name',
      flex: 1,
      editable: true,
      cellRenderer: (params: any) => (
        <Field
          showLabel={false}
          showHelptext={false}
          placeholder="성명"
          value={params.value}
          onChange={(e: any) => {
            const newValue = e.target.value;
            params.node.setDataValue('name', newValue);
          }}
        />
      ),
    },
    {
      headerName: '휴대폰번호',
      field: 'phone',
      flex: 1,
      editable: true,
      cellRenderer: (params: any) => (
        <Field
          showLabel={false}
          showHelptext={false}
          placeholder="휴대폰번호"
          value={params.value}
          onChange={(e: any) => {
            const newValue = e.target.value;
            params.node.setDataValue('phone', newValue);
          }}
        />
      ),
    },
  ];

  return (
    <Drawer open={true} onClose={() => window.history.back()} size="xl">
      <Drawer.Header title="보플 PUSH 발송" />
      <Drawer.Body>
        <div className="grid grid-cols-12 gap-8">
          {/* [좌측 영역] 메시지 작성 및 발송 패널 */}
          <div className="col-span-4 flex flex-col gap-6 border-r border-default pr-8">
            {/* 통합 메시지 입력 영역 */}
            <div className="flex flex-col gap-2">
              <Alert
                type="info"
                body={
                  <span className="text-base font-medium">
                    수신자/발신자명을 넣고자 하는 부분에<br />
                    &#123;수신자명&#125;, &#123;발신자명&#125;로 입력하시면 됩니다.
                  </span>
                }
              />
              <div className="flex justify-between items-center mt-2">
                <h3 className="text-sm font-medium text-primary">메시지</h3>
                <span className="text-xs text-secondary">{message.length} / 2000 byte</span>
              </div>
              <div className="relative">
                <Field
                  multiline
                  rowsVariant="flexible"
                  showLabel={false}
                  showHelptext={false}
                  placeholder="템플릿을 선택하면 여기에 바로 입력됩니다"
                  value={message}
                  onChange={(e: any) => setMessage(e.target.value)}
                  inputProps={{ 
                    style: { 
                      fontSize: '18px', 
                      lineHeight: '1.6', 
                      minHeight: '320px' 
                    } 
                  }}
                />
                <div className="absolute bottom-3 right-3">
                  <IconButton
                    iconOnly={<Icon name="reset" size={20} />}
                    iconButtonType="ghost"
                    size="sm"
                    aria-label="초기화"
                    onClick={() => setMessage('')}
                  />
                </div>
              </div>
            </div>

            <Divider tone="subtle" />

            {/* 발신 설정 */}
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-primary">보내는 사람</h3>
                <Field
                  showLabel={false}
                  showHelptext={false}
                  value={senderNumber}
                  onChange={(e: any) => setSenderNumber(e.target.value)}
                />
              </div>
              
              <div className="flex flex-col gap-3">
                <OptionGroup showLabel={false} orientation="horizontal">
                  <Option label="즉시전송" size="md">
                    <Radio 
                      value="immediate"
                      interaction={sendTime === 'immediate' ? 'default' : 'default'}
                      onChange={() => setSendTime('immediate')} 
                    />
                  </Option>
                  <Option label="예약전송" size="md">
                    <Radio 
                      value="reserved"
                      interaction={sendTime === 'reserved' ? 'default' : 'default'}
                      onChange={() => setSendTime('reserved')} 
                    />
                  </Option>
                </OptionGroup>

                {sendTime === 'reserved' && (
                  <div className="flex flex-col gap-2 p-4 bg-canvas rounded-lg border border-default">
                    <Field 
                      type="date" 
                      label="예약일자" 
                      showLabel={true} 
                      showHelptext={false} 
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <Select label="시" showLabel={true} showHelptext={false} placeholder="시" options={Array.from({length: 24}, (_, i) => ({ value: String(i).padStart(2, '0'), label: `${i}시` }))} />
                      <Select label="분" showLabel={true} showHelptext={false} placeholder="분" options={Array.from({length: 60}, (_, i) => ({ value: String(i).padStart(2, '0'), label: `${i}분` }))} />
                      <Select label="초" showLabel={true} showHelptext={false} placeholder="초" options={Array.from({length: 60}, (_, i) => ({ value: String(i).padStart(2, '0'), label: `${i}초` }))} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* [우측 영역] 템플릿/대상자 관리 패널 */}
          <div className="col-span-8 flex flex-col gap-6">
          {/* 상단 안내 (Sticky 고정) */}
          <div className="sticky top-0 z-10 flex justify-end items-center bg-white pb-4">
            <Button buttonType="ghost" size="sm" label="과금안내" />
          </div>

          {/* 템플릿 선택 영역 */}
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <div className="w-48 shrink-0">
                <h3 className="text-sm font-medium text-secondary">카테고리</h3>
              </div>
              <div className="flex-1 flex justify-center">
                <Segment
                  items={[
                    { value: 'sample', label: '샘플보관함' },
                    { value: 'sent', label: '발송보관함' },
                    { value: 'personal', label: '개인보관함' },
                  ]}
                  value={mainTab}
                  onChange={setMainTab}
                  size="md"
                  widthMode="content"
                />
              </div>
            </div>

            <div className="flex gap-6 items-start">
            {/* 카테고리 메뉴 */}
            <div className="w-48 flex flex-col border border-default rounded-lg bg-surface overflow-hidden shrink-0">
              {categories.map((cat) => (
                <div key={cat.id} className="flex flex-col border-b border-default last:border-b-0">
                  <button
                    onClick={() => {
                      setCategory(cat.id);
                      setSelectedSub('전체');
                    }}
                    className={`px-4 py-4 text-base text-left transition-colors flex items-center justify-between ${
                      category === cat.id ? 'bg-canvas text-accent font-bold' : 'text-primary hover:bg-canvas'
                    }`}
                  >
                    {cat.label}
                    <Icon 
                      name={category === cat.id ? "chevron-up" : "chevron-down"} 
                      size={16} 
                      className={category === cat.id ? "text-accent" : "text-secondary"} 
                    />
                  </button>
                  {category === cat.id && (
                    <div className="bg-surface py-2 flex flex-col">
                      {cat.sub.map((sub) => (
                        <button
                          key={sub}
                          onClick={() => setSelectedSub(sub)}
                          className={`px-6 py-2 text-base text-left transition-colors ${
                            selectedSub === sub ? 'text-accent font-semibold' : 'text-secondary hover:text-primary'
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 템플릿 카드 그리드 */}
            <div className="flex-1 flex flex-col gap-4">
              <div className="flex justify-start">
                <Tab
                  items={[
                    { value: 'short', label: '단문(SMS)' },
                    { value: 'long', label: '장문(LMS)' },
                    { value: 'photo', label: 'BP' },
                  ]}
                  value={subTab}
                  onChange={setSubTab}
                  widthMode="content"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                {templates
                  .filter((tpl) => tpl.type === subTab)
                  .map((tpl) => (
                    <div
                      key={tpl.id}
                      onClick={() => handleTemplateClick(tpl.body)}
                      className="border border-default rounded-lg overflow-hidden cursor-pointer hover:border-accent hover:shadow-md transition-all bg-surface flex flex-col"
                    >
                      <div className="p-3 border-b border-default bg-canvas/30">
                        <span className="text-sm font-medium text-secondary">{tpl.title}</span>
                      </div>
                      <div className={`p-4 flex-1 ${subTab === 'short' ? 'min-h-[160px]' : 'min-h-[240px]'}`}>
                        <p className={`text-base text-primary leading-relaxed ${subTab === 'short' ? 'line-clamp-6' : 'line-clamp-[12]'}`}>
                          {tpl.body}
                        </p>
                      </div>
                      <div className="p-3 border-t border-default flex justify-between items-center bg-canvas/10">
                        <div className="text-sm">
                          <span className="text-accent font-bold">{tpl.byte}</span>
                          <span className="text-primary font-normal"> byte</span>
                        </div>
                        <span className="text-sm text-accent font-medium">
                          {subTab === 'short' ? '단문' : subTab === 'long' ? '장문' : 'BP'}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>

          {/* 메시지 유형 설정 영역 */}
          <div className="py-4">
            <div className="flex items-center gap-8">
              <h2 className="text-lg font-semibold text-primary min-w-[80px]">메시지 유형</h2>
              <div className="flex flex-wrap gap-x-10 items-center">
                <Option label="공지" size="lg">
                  <Radio value="notice" onChange={() => setPushType('notice')} />
                </Option>
                <Option label="사업단(본부)" size="lg">
                  <Radio value="org" onChange={() => setPushType('org')} />
                </Option>
                <Option label="인포DB" size="lg">
                  <Radio value="infodb" onChange={() => setPushType('infodb')} />
                </Option>
                <Option label="시책" size="lg">
                  <Radio value="policy" onChange={() => setPushType('policy')} />
                </Option>
                <Option label="경조사" size="lg">
                  <Radio value="event" onChange={() => setPushType('event')} />
                </Option>
                <Option label="회장님" size="lg">
                  <Radio value="chairman" onChange={() => setPushType('chairman')} />
                </Option>
              </div>
            </div>
          </div>

          {/* 발송대상 설정 영역 */}
          <div className="pt-4">
            <RowPattern pattern="RP-1">
              <RowSlot slot="actions">
                <div className="flex justify-between items-center w-full mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-primary">발송대상</h2>
                    <span className="text-lg font-semibold text-accent">(총 {recipients.length}명)</span>
                  </div>
                  <div className="flex gap-2">
                    <Button buttonType="tertiary" size="sm" label="대상추가" startIcon={<Icon name="add" size={16} />} showStartIcon={true} onClick={() => setIsSearchOpen(true)} />
                    <Button 
                      buttonType={isDeleteMode ? "destructive" : "tertiary"} 
                      size="sm" 
                      label={isDeleteMode ? (selectedIds.size > 0 ? `${selectedIds.size}명 삭제` : "취소") : "대상삭제"} 
                      startIcon={<Icon name={isDeleteMode ? "delete" : "minus"} size={16} />} 
                      showStartIcon={true} 
                      onClick={toggleDeleteMode} 
                    />
                    <Button buttonType="tertiary" size="sm" label="직접입력(외부)" startIcon={<Icon name="external" size={16} />} showStartIcon={true} onClick={() => setRecipients([...recipients, { id: Date.now(), name: '', phone: '' }])} />
                  </div>
                </div>
              </RowSlot>
              <RowSlot slot="grid">
                <div className="w-full border border-default rounded-lg overflow-hidden">
                  <DataGrid
                    rowData={showAllRecipients ? recipients : recipients.slice(0, 5)}
                    columnDefs={columnDefs}
                    domLayout="autoHeight"
                    headerHeight={42}
                    rowHeight={52}
                  />
                </div>
                {recipients.length > 5 && (
                  <div className="flex justify-center mt-4">
                    <Button
                      buttonType="ghost"
                      size="sm"
                      label={showAllRecipients ? "닫기" : "더보기"}
                      endIcon={<Icon name={showAllRecipients ? "chevron-up" : "chevron-down"} size={16} />}
                      showEndIcon={true}
                      onClick={() => setShowAllRecipients(!showAllRecipients)}
                    />
                  </div>
                )}
              </RowSlot>
            </RowPattern>
          </div>
        </div>
      </Drawer.Body>
      <Drawer.Footer>
        <div className="flex justify-between items-center w-full">
          <Button buttonType="tertiary" size="lg" label="닫기" onClick={() => window.history.back()} />
          <div className="flex gap-2">
            <Button buttonType="tertiary" size="lg" label="미리보기" />
            <Button buttonType="primary" size="lg" label="발송하기" />
          </div>
        </div>
      </Drawer.Footer>
      </Drawer>

      {/* 발송대상조회 다이얼로그 */}
      <Dialog open={isSearchOpen} onClose={() => setIsSearchOpen(false)} size="lg">
        <Dialog.Header title="발송대상조회" />
        <Dialog.Body>
          <div className="flex flex-col gap-6">
            <div className="bg-canvas p-4 rounded-lg">
              <div className="grid grid-cols-12 gap-4 items-end">
                <div className="col-span-4">
                  <Field label="성명" showLabel={true} showHelptext={false} placeholder="이름 입력" />
                </div>
                <div className="col-span-4">
                  <Field label="부서명" showLabel={true} showHelptext={false} placeholder="부서 입력" />
                </div>
                <div className="col-span-4 flex justify-end">
                  <Button buttonType="primary" size="md" label="조회" startIcon={<Icon name="search" size={16} />} showStartIcon={true} />
                </div>
              </div>
            </div>
            
            <div className="border border-default rounded-lg overflow-hidden">
              <DataGrid
                rowData={[
                  { id: 101, name: '이서준', dept: '디지털마케팅팀', phone: '010-1234-1111' },
                  { id: 102, name: '김지우', dept: '영업지원팀', phone: '010-1234-2222' },
                  { id: 103, name: '박하준', dept: '경영관리팀', phone: '010-1234-3333' },
                  { id: 104, name: '최아윤', dept: 'IT개발본부', phone: '010-1234-4444' },
                  { id: 105, name: '정도윤', dept: 'CS센터', phone: '010-1234-5555' },
                ]}
                columnDefs={[
                  { field: 'name', headerName: '성명', flex: 1 },
                  { field: 'dept', headerName: '부서명', flex: 1 },
                  { field: 'phone', headerName: '휴대폰번호', flex: 1 },
                ]}
                rowSelection={{ mode: 'multiRow', checkboxes: true, headerCheckbox: true }}
                domLayout="autoHeight"
              />
            </div>
          </div>
        </Dialog.Body>
        <Dialog.Footer>
          <Button buttonType="tertiary" size="md" label="취소" onClick={() => setIsSearchOpen(false)} />
          <Button 
            buttonType="primary" 
            size="md" 
            label="추가하기" 
            onClick={() => addRecipient([{ id: 101, name: '이서준', phone: '010-1234-1111' }, { id: 102, name: '김지우', phone: '010-1234-2222' }])} 
          />
        </Dialog.Footer>
      </Dialog>
    </div>
  );
};

export default PushSend;