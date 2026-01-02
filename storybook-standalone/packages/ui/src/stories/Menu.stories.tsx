import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { within, userEvent } from '@storybook/test';
import { Menu, MenuItem } from '../components/Menu';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';

const sampleMenuData: MenuItem[] = [
  {
    id: '1',
    label: '새 파일',
    leftIcon: <Icon name="plus" />,
    onClick: () => console.log('새 파일 클릭'),
  },
  {
    id: '2',
    label: '파일 열기',
    leftIcon: <Icon name="post" />,
    onClick: () => console.log('파일 열기 클릭'),
  },
  { id: 'divider-1' },
  {
    id: '3',
    label: '저장',
    leftIcon: <Icon name="list-alt" />,
    badge: <Icon name="alert-success" size={18} />,
    onClick: () => console.log('저장 클릭'),
  },
  {
    id: '4',
    label: '다른 이름으로 저장',
    onClick: () => console.log('다른 이름으로 저장 클릭'),
  },
  { id: 'divider-2' },
  {
    id: '5',
    label: '삭제',
    leftIcon: <Icon name="close" />,
    destructive: true,
    onClick: () => console.log('삭제 클릭'),
  },
];

const hierarchicalMenuData: MenuItem[] = [
  {
    id: '1',
    label: '파일',
    leftIcon: <Icon name="post" />,
    children: [
      {
        id: '1-1',
        label: '새로 만들기',
        leftIcon: <Icon name="plus" />,
        children: [
          { id: '1-1-1', label: '텍스트 파일' },
          { id: '1-1-2', label: 'HTML 파일' },
          { id: '1-1-3', label: 'JavaScript 파일' },
        ],
      },
      {
        id: '1-2',
        label: '열기',
        leftIcon: <Icon name="external-link" />,
      },
      { id: 'divider-1' },
      {
        id: '1-3',
        label: '최근 파일',
        children: [
          { id: '1-3-1', label: 'document.txt' },
          { id: '1-3-2', label: 'index.html' },
          { id: '1-3-3', label: 'app.js' },
        ],
      },
    ],
  },
  {
    id: '2',
    label: '편집',
    leftIcon: <Icon name="list-alt" />,
    children: [
      { id: '2-1', label: '실행 취소' },
      { id: '2-2', label: '다시 실행' },
      { id: 'divider-2' },
      { id: '2-3', label: '잘라내기' },
      { id: '2-4', label: '복사' },
      { id: '2-5', label: '붙여넣기' },
    ],
  },
  {
    id: '3',
    label: '보기',
    leftIcon: <Icon name="widgets" />,
    children: [
      { id: '3-1', label: '전체 화면', badge: <Icon name="alert-success" size={18} /> },
      { id: '3-2', label: '축소' },
      { id: '3-3', label: '확대' },
    ],
  },
];

const groupedMenuData: MenuItem[] = [
  {
    id: 'heading-1',
    heading: '파일 작업',
  },
  {
    id: '1',
    label: '새 파일',
    leftIcon: <Icon name="plus" />,
  },
  {
    id: '2',
    label: '파일 열기',
    leftIcon: <Icon name="post" />,
  },
  { id: 'divider-1' },
  {
    id: 'heading-2',
    heading: '편집 작업',
  },
  {
    id: '3',
    label: '잘라내기',
  },
  {
    id: '4',
    label: '복사',
  },
  {
    id: '5',
    label: '붙여넣기',
  },
];

const titleDescriptionMenuData: MenuItem[] = [
  {
    id: '1',
    title: '프로필 편집',
    description: '프로필 정보 및 설정을 변경합니다',
    leftIcon: <Icon name="person" />,
  },
  {
    id: '2',
    title: '알림 설정',
    description: '알림 수신 방법을 선택합니다',
    leftIcon: <Icon name="alert-info" />,
  },
  { id: 'divider-1' },
  {
    id: '3',
    title: '계정 삭제',
    description: '계정을 영구적으로 삭제합니다',
    leftIcon: <Icon name="close" />,
    destructive: true,
  },
];

const meta: Meta<typeof Menu> = {
  title: 'UI/Menu',
  component: Menu,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md'],
      description: 'Menu size variant',
    },
    items: {
      control: { type: 'select' },
      options: ['basic', 'hierarchical', 'withHeadings', 'titleDescription', 'withSelected', 'withDisabled'],
      mapping: {
        basic: sampleMenuData,
        hierarchical: hierarchicalMenuData,
        withHeadings: groupedMenuData,
        titleDescription: titleDescriptionMenuData,
        withSelected: [
          { id: '1', label: '작은 아이콘' },
          { id: '2', label: '중간 아이콘', selected: true },
          { id: '3', label: '큰 아이콘' },
          { id: 'divider-1' },
          { id: '4', label: '목록' },
          { id: '5', label: '격자' },
        ],
        withDisabled: [
          { id: '1', label: '활성화됨', leftIcon: <Icon name="alert-success" /> },
          { id: '2', label: '비활성화됨', leftIcon: <Icon name="close" />, disabled: true },
          { id: '3', label: '활성화됨', leftIcon: <Icon name="alert-success" /> },
          { id: 'divider-1' },
          { id: '4', label: '삭제 (비활성)', destructive: true, disabled: true },
        ],
      },
      description: 'Menu items data (select preset)',
    },
    title: {
      control: { type: 'text' },
      description: 'Menu container title (optional)',
    },
    description: {
      control: { type: 'text' },
      description: 'Menu container description (optional)',
    },
    onItemClick: { action: 'item clicked', table: { disable: true } },
    onClose: { action: 'menu closed', table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Menu>;

export const Default: Story = {
  args: {
    size: 'md',
    items: sampleMenuData,
  },
  render: (args) => (
    <div className="flex h-[400px] items-start justify-center pt-8">
      <Menu {...args} />
    </div>
  ),
};

export const EmptyState: Story = {
  args: {
    size: 'md',
    items: [],
  },
  render: (args) => (
    <div className="flex h-[400px] items-start justify-center pt-8">
      <Menu {...args} />
    </div>
  ),
};

/**
 * emptyText prop을 사용하여 빈 상태 메시지를 커스터마이즈할 수 있습니다.
 */
export const EmptyStateCustomText: Story = {
  args: {
    size: 'md',
    items: [],
    emptyText: '선택 가능한 항목이 없습니다',
  },
  render: (args) => (
    <div className="flex h-[400px] items-start justify-center pt-8">
      <Menu {...args} />
    </div>
  ),
};

export const WithSelected: Story = {
  args: {
    size: 'md',
    items: [
      { id: '1', label: '작은 아이콘', leftIcon: <Icon name="widgets" /> },
      { id: '2', label: '중간 아이콘', leftIcon: <Icon name="widgets" />, selected: true },
      { id: '3', label: '큰 아이콘', leftIcon: <Icon name="widgets" /> },
      { id: 'divider-1' },
      { id: '4', label: '목록' },
      { id: '5', label: '격자' },
    ],
  },
  render: (args) => (
    <div className="flex h-[400px] items-start justify-center pt-8">
      <Menu {...args} />
    </div>
  ),
};

export const LabelOnly: Story = {
  args: {
    size: 'md',
    items: [
      { id: '1', label: '새 프로젝트 만들기' },
      { id: '2', label: '기존 프로젝트 열기' },
      { id: '3', label: '최근 프로젝트' },
      { id: 'divider-1' },
      { id: '4', label: '프로젝트 저장' },
      { id: '5', label: '다른 이름으로 저장' },
      { id: '6', label: '모두 저장' },
      { id: 'divider-2' },
      { id: '7', label: '가져오기' },
      { id: '8', label: '내보내기' },
      { id: '9', label: '공유하기' },
      { id: 'divider-3' },
      { id: '10', label: '인쇄' },
      { id: '11', label: '인쇄 미리보기' },
      { id: 'divider-4' },
      { id: '12', label: '페이지 설정' },
      { id: '13', label: '문서 속성' },
      { id: '14', label: '버전 기록' },
      { id: 'divider-5' },
      { id: '15', label: '설정' },
      { id: '16', label: '환경 설정' },
      { id: '17', label: '키보드 단축키' },
      { id: 'divider-6' },
      { id: '18', label: '템플릿 관리' },
      { id: '19', label: '플러그인 관리' },
      { id: '20', label: '확장 프로그램' },
      { id: 'divider-7' },
      { id: '21', label: '도움말' },
      { id: '22', label: '튜토리얼' },
      { id: '23', label: '문서' },
      { id: '24', label: '커뮤니티' },
      { id: 'divider-8' },
      { id: '25', label: '피드백 보내기' },
      { id: '26', label: '버그 신고' },
      { id: '27', label: '기능 제안' },
      { id: 'divider-9' },
      { id: '28', label: '라이선스 정보' },
      { id: '29', label: '업데이트 확인' },
      { id: '30', label: '정보' },
      { id: 'divider-10' },
      { id: '31', label: '종료', destructive: true },
    ],
  },
  render: (args) => (
    <div className="flex h-[600px] items-start justify-center pt-8">
      <Menu {...args} />
    </div>
  ),
};

export const ItemTitleDescription: Story = {
  args: {
    size: 'md',
    items: titleDescriptionMenuData,
  },
  render: (args) => (
    <div className="flex h-[400px] items-start justify-center pt-8">
      <Menu {...args} />
    </div>
  ),
};

/**
 * leftIcon + maintext + subtext 패턴의 다양한 예시
 * 다양한 사용 사례를 보여주는 실용적인 예시입니다.
 */
export const IconWithTitleDescription: Story = {
  args: {
    size: 'md',
    items: [
      {
        id: '1',
        title: '새 문서 작성',
        description: '빈 문서를 생성하여 작업을 시작합니다',
        leftIcon: <Icon name="plus" />,
      },
      {
        id: '2',
        title: '템플릿에서 생성',
        description: '미리 정의된 템플릿을 사용하여 문서를 만듭니다. 다양한 형식의 템플릿이 제공되며, 프로젝트 유형에 맞는 템플릿을 선택할 수 있습니다.',
        leftIcon: <Icon name="post" />,
      },
      {
        id: '3',
        title: '최근 문서 열기',
        description: '최근에 작업한 문서 목록을 확인하고 빠르게 접근할 수 있습니다. 최근 30일간 수정된 파일들이 시간순으로 정렬되어 표시됩니다.',
        leftIcon: <Icon name="list-alt" />,
      },
      { id: 'divider-1' },
      {
        id: '4',
        title: '클라우드에서 가져오기',
        description: '클라우드 저장소에서 문서를 불러옵니다',
        leftIcon: <Icon name="external-link" />,
      },
      {
        id: '5',
        title: '공유 문서 보기',
        description: '다른 사용자가 공유한 문서를 확인합니다',
        leftIcon: <Icon name="person" />,
        badge: <Icon name="alert-info" size={18} />,
      },
      { id: 'divider-2' },
      {
        id: '6',
        title: '모두 닫기',
        description: '현재 열려있는 모든 문서를 닫습니다',
        leftIcon: <Icon name="close" />,
        destructive: true,
      },
    ],
  },
  render: (args) => (
    <div className="flex h-[600px] items-start justify-center pt-8">
      <Menu {...args} />
    </div>
  ),
};

export const WithBadge: Story = {
  args: {
    size: 'md',
    items: [
      {
        id: '1',
        label: '알림',
        leftIcon: <Icon name="alert-info" />,
        badge: <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-alert-error-bg text-alert-error-text text-caption-xs-bold">3</span>,
      },
      {
        id: '2',
        label: '메시지',
        leftIcon: <Icon name="post" />,
        badge: <span className="flex items-center justify-center w-[18px] h-[18px] rounded-full bg-alert-warning-bg text-alert-warning-text text-caption-xs-bold">12</span>,
      },
      { id: 'divider-1' },
      {
        id: '3',
        label: '저장 완료',
        leftIcon: <Icon name="list-alt" />,
        badge: <Icon name="alert-success" size={18} />,
      },
      {
        id: '4',
        label: '동기화 중',
        leftIcon: <Icon name="external-link" />,
        badge: <Icon name="alert-info" size={18} />,
      },
      {
        id: '5',
        label: '오류 발생',
        leftIcon: <Icon name="close" />,
        badge: <Icon name="alert-error" size={18} />,
        destructive: true,
      },
      { id: 'divider-2' },
      {
        id: '6',
        label: '새 기능',
        leftIcon: <Icon name="plus" />,
        badge: <span className="px-1 py-0.5 rounded text-caption-xs-bold bg-bg-accent text-text-inverse">NEW</span>,
      },
      {
        id: '7',
        label: '베타 기능',
        leftIcon: <Icon name="widgets" />,
        badge: <span className="px-1 py-0.5 rounded text-caption-xs-bold bg-bg-selection text-text-accent">BETA</span>,
      },
    ],
  },
  render: (args) => (
    <div className="flex h-[600px] items-start justify-center pt-8">
      <Menu {...args} />
    </div>
  ),
};

export const TitleDescription: Story = {
  args: {
    size: 'md',
    title: '문서 작업',
    description: '문서 관련 작업을 선택하세요',
    items: [],
    emptyText: '',
  },
  render: (args) => (
    <div className="flex h-[600px] items-start justify-center pt-8">
      <Menu {...args} />
    </div>
  ),
};

export const WithToggleButton: Story = {
  args: {
    size: 'md',
    items: hierarchicalMenuData,
  },
  render: (args) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const [menuPosition, setMenuPosition] = React.useState<{ x: number; y: number } | undefined>();

    const handleToggle = () => {
      if (!isOpen && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setMenuPosition({
          x: rect.left,
          y: rect.bottom + 4,
        });
      }
      setIsOpen(!isOpen);
    };

    return (
      <div className="flex h-[600px] items-start justify-center pt-8">
        <Button ref={buttonRef} onClick={handleToggle}>
          메뉴 {isOpen ? '닫기' : '열기'}
        </Button>
        {isOpen && (
          <Menu
            {...args}
            position={menuPosition}
            triggerRef={buttonRef}
            onClose={() => setIsOpen(false)}
          />
        )}
      </div>
    );
  },
};

const wideMenuData: MenuItem[] = [
  {
    id: '1',
    label: '매우 긴 메뉴 아이템 이름이 있는 첫 번째 항목',
    leftIcon: <Icon name="plus" />,
  },
  {
    id: '2',
    label: '또 다른 긴 메뉴 아이템 설명이 포함된 두 번째 항목',
    leftIcon: <Icon name="post" />,
  },
  {
    id: '3',
    label: '매우매우 긴 텍스트를 가진 세 번째 메뉴 항목',
    leftIcon: <Icon name="list-alt" />,
  },
];

export const MenuPositioningInContainer: Story = {
  args: {
    size: 'md',
  },
  render: (args) => {
    const [narrowMenuOpen, setNarrowMenuOpen] = React.useState(false);
    const [narrowMenuPositioned, setNarrowMenuPositioned] = React.useState(false);
    const [wideMenuOpen, setWideMenuOpen] = React.useState(false);
    const [wideMenuPositioned, setWideMenuPositioned] = React.useState(false);

    const narrowButtonRef = React.useRef<HTMLButtonElement>(null);
    const wideButtonRef = React.useRef<HTMLButtonElement>(null);
    const containerRef = React.useRef<HTMLDivElement>(null);

    const [narrowMenuPosition, setNarrowMenuPosition] = React.useState<{ x: number; y: number } | undefined>();
    const [wideMenuPosition, setWideMenuPosition] = React.useState<{ x: number; y: number } | undefined>();

    const handleMenuToggle = (
      isNarrow: boolean,
      currentOpen: boolean,
      setOpen: (v: boolean) => void,
      setPositioned: (v: boolean) => void,
      setPosition: (v: { x: number; y: number }) => void,
      buttonRef: React.RefObject<HTMLButtonElement>
    ) => {
      if (!currentOpen && buttonRef.current && containerRef.current) {
        const buttonRect = buttonRef.current.getBoundingClientRect();
        const containerRect = containerRef.current.getBoundingClientRect();
        const containerStyle = getComputedStyle(containerRef.current);
        const paddingRight = parseInt(containerStyle.paddingRight);

        const contentRightEdge = containerRect.right - paddingRight;

        const baseY = buttonRect.bottom + 4;

        // 화면 밖에서 렌더링하여 측정
        setPosition({ x: -9999, y: baseY });
        setPositioned(false);
        setOpen(true);

        // 메뉴가 렌더링된 후 너비 측정 및 위치 조정
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const menuElements = document.querySelectorAll('[role="menu"]');
            const menuElement = Array.from(menuElements).find(el => {
              const rect = el.getBoundingClientRect();
              return rect.top === baseY;
            }) as HTMLElement;

            if (menuElement) {
              const menuWidth = menuElement.offsetWidth;

              // 기본: 메뉴 왼쪽 = 버튼 왼쪽
              let finalX = buttonRect.left;

              // 메뉴가 컨테이너 오른쪽을 넘어가는지 체크
              if (finalX + menuWidth > contentRightEdge) {
                // 컨테이너 오른쪽에 맞춤
                finalX = contentRightEdge - menuWidth;
              }

              setPosition({ x: finalX, y: baseY });
              setPositioned(true);
            }
          });
        });
      } else {
        setOpen(false);
        setPositioned(false);
      }
    };

    return (
      <div className="flex h-[700px] items-start justify-center pt-8">
        <div
          ref={containerRef}
          className="w-[600px] border-2 border-purple-500 p-[16px] bg-gray-50"
        >
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-purple-600 mb-2">
              컨테이너 제약 내 메뉴 위치 조정 (600px, padding: 16px)
            </h3>
            <p className="text-xs text-gray-600">
              기본: 메뉴 왼쪽 = 버튼 왼쪽, 넘어가면: 메뉴 오른쪽 = 컨테이너 오른쪽
            </p>
          </div>

          {/* 좁은 메뉴 */}
          <div className="mb-8 pb-8 border-b border-gray-300">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-700">1. 좁은 메뉴 (메뉴 왼쪽 = 버튼 왼쪽)</span>
            </div>
            <div className="flex justify-end pr-[100px]">
              <Button
                ref={narrowButtonRef}
                onClick={() => handleMenuToggle(
                  true,
                  narrowMenuOpen,
                  setNarrowMenuOpen,
                  setNarrowMenuPositioned,
                  setNarrowMenuPosition,
                  narrowButtonRef
                )}
              >
                좁은 메뉴 {narrowMenuOpen ? '닫기' : '열기'}
              </Button>
            </div>
            {narrowMenuOpen && (() => {
              const menuStyle = { opacity: narrowMenuPositioned ? 1 : 0, transition: 'opacity 0.05s' };
              return (
                <div style={menuStyle}>
                  <Menu
                    {...args}
                    items={sampleMenuData}
                    position={narrowMenuPosition}
                    triggerRef={narrowButtonRef}
                    onClose={() => {
                      setNarrowMenuOpen(false);
                      setNarrowMenuPositioned(false);
                    }}
                  />
                </div>
              );
            })()}
          </div>

          {/* 넓은 메뉴 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-700">2. 넓은 메뉴 (컨테이너 오른쪽을 넘어가면 오른쪽 맞춤)</span>
            </div>
            <div className="flex justify-end pr-[100px]">
              <Button
                ref={wideButtonRef}
                onClick={() => handleMenuToggle(
                  false,
                  wideMenuOpen,
                  setWideMenuOpen,
                  setWideMenuPositioned,
                  setWideMenuPosition,
                  wideButtonRef
                )}
              >
                넓은 메뉴 {wideMenuOpen ? '닫기' : '열기'}
              </Button>
            </div>
            {wideMenuOpen && (() => {
              const menuStyle = { opacity: wideMenuPositioned ? 1 : 0, transition: 'opacity 0.05s' };
              return (
                <div style={menuStyle}>
                  <Menu
                    {...args}
                    items={wideMenuData}
                    position={wideMenuPosition}
                    triggerRef={wideButtonRef}
                    onClose={() => {
                      setWideMenuOpen(false);
                      setWideMenuPositioned(false);
                    }}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  },
};

/**
 * Checkbox Mode (Control Prop)
 *
 * checkboxMode prop을 사용하여 MenuItem에 Checkbox를 자동으로 추가합니다.
 * MenuItem 객체는 순수 데이터만 포함하므로 Storybook에서 직렬화 오류가 발생하지 않습니다.
 */
export const WithCheckboxMode: Story = {
  args: {
    size: 'md',
  },
  render: (args) => {
    const [checkedIds, setCheckedIds] = React.useState(new Set(['2']));

    // MenuItem은 순수 데이터만 (React 엘리먼트 없음!)
    const items: MenuItem[] = [
      {
        id: '1',
        label: '옵션 1',
      },
      {
        id: '2',
        label: '옵션 2',
      },
      {
        id: '3',
        label: '옵션 3',
      },
      {
        id: '4',
        label: '옵션 4 (비활성)',
        disabled: true,
      },
    ];

    return (
      <div className="p-8">
        <h3 className="mb-4 text-lg font-bold">Checkbox Mode</h3>
        <p className="mb-4 text-sm text-gray-600">
          checkboxMode="checkbox" prop으로 자동 렌더링
        </p>
        <Menu
          {...args}
          items={items}
          checkboxMode="checkbox"
          checkedIds={checkedIds}
          onCheckChange={(id, checked) => {
            setCheckedIds((prev) => {
              const newSet = new Set(prev);
              if (checked) {
                newSet.add(id);
              } else {
                newSet.delete(id);
              }
              return newSet;
            });
          }}
        />
        <div className="mt-4 p-3 bg-blue-50 rounded">
          <p className="text-sm font-medium">선택된 항목:</p>
          <p className="text-sm text-gray-700">
            {Array.from(checkedIds).join(', ') || '없음'}
          </p>
        </div>
      </div>
    );
  },
};

/**
 * Radio Mode (Control Prop)
 *
 * checkboxMode="radio" prop을 사용하여 단일 선택 Radio 메뉴를 구현합니다.
 */
export const WithRadioMode: Story = {
  args: {
    size: 'md',
  },
  render: (args) => {
    const [selectedId, setSelectedId] = React.useState('2');

    const items: MenuItem[] = [
      {
        id: '1',
        label: '옵션 1',
        description: '첫 번째 옵션',
      },
      {
        id: '2',
        label: '옵션 2',
        description: '두 번째 옵션 (기본 선택)',
      },
      {
        id: '3',
        label: '옵션 3',
        description: '세 번째 옵션',
      },
    ];

    const checkedIds = new Set([selectedId]);

    return (
      <div className="p-8">
        <h3 className="mb-4 text-lg font-bold">Radio Mode</h3>
        <p className="mb-4 text-sm text-gray-600">
          checkboxMode="radio" prop으로 단일 선택 구현
        </p>
        <Menu
          {...args}
          items={items}
          checkboxMode="radio"
          checkedIds={checkedIds}
          onCheckChange={(id) => {
            setSelectedId(id);
          }}
        />
        <div className="mt-4 p-3 bg-green-50 rounded">
          <p className="text-sm font-medium">선택된 옵션: {selectedId}</p>
        </div>
      </div>
    );
  },
};
