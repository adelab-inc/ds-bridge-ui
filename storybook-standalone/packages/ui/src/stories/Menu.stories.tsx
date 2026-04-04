import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Menu, type MenuItem } from '../components/Menu';
import { Icon } from '../components/Icon';
import { Button } from '../components/Button';

/* ─── Menu 메인 스토리 ─── */

const hierarchicalMenuData: MenuItem[] = [
  {
    type: 'submenu',
    id: '1',
    label: '파일',
    children: [
      {
        type: 'submenu',
        id: '1-1',
        label: '새로 만들기',
        children: [
          { type: 'text-only', id: '1-1-1', label: '텍스트 파일' },
          { type: 'text-only', id: '1-1-2', label: 'HTML 파일' },
          { type: 'text-only', id: '1-1-3', label: 'JavaScript 파일' },
        ],
      },
      { type: 'link', id: '1-2', label: '열기' },
      { type: 'divider' },
      {
        type: 'submenu',
        id: '1-3',
        label: '최근 파일',
        children: [
          { type: 'text-only', id: '1-3-1', label: 'document.txt' },
          { type: 'text-only', id: '1-3-2', label: 'index.html' },
          { type: 'text-only', id: '1-3-3', label: 'app.js' },
        ],
      },
    ],
  },
  {
    type: 'submenu',
    id: '2',
    label: '편집',
    children: [
      { type: 'text-only', id: '2-1', label: '실행 취소' },
      { type: 'text-only', id: '2-2', label: '다시 실행' },
      { type: 'divider' },
      { type: 'text-only', id: '2-3', label: '잘라내기' },
      { type: 'text-only', id: '2-4', label: '복사' },
      { type: 'text-only', id: '2-5', label: '붙여넣기' },
    ],
  },
  {
    type: 'submenu',
    id: '3',
    label: '보기',
    children: [
      { type: 'text-only', id: '3-1', label: '전체 화면' },
      { type: 'text-only', id: '3-2', label: '축소' },
      { type: 'text-only', id: '3-3', label: '확대' },
    ],
  },
  { type: 'divider' },
  { type: 'text-only', id: '4', label: '설정' },
  { type: 'destructive', id: '5', label: '종료' },
];

const meta: Meta<typeof Menu> = {
  title: 'UI/Menu',
  component: Menu,
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['md', 'sm'],
    },
  },
  parameters: {
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '### Menu 컨테이너',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Size` | `size` | 동일. `md` (기본) / `sm` |',
          '| *(없음)* | `emptyText` | Figma에 없는 코드 전용. 아이템이 없을 때 표시할 텍스트 |',
          '| *(없음)* | `position` | Figma에 없는 코드 전용. 메뉴 표시 위치 (x, y) |',
          '| *(없음)* | `onItemClick` | 아이템 클릭 콜백. `(item: MenuItemBase) => void` |',
          '| *(없음)* | `onClose` | 메뉴 닫힘 콜백 |',
          '',
          '### Compound Component (권장 사용 방식)',
          '',
          '| 컴포넌트 | 용도 | 비고 |',
          '|---|---|---|',
          '| `Menu.Root` | 상태 관리 + Context Provider | `boundary` prop으로 메뉴 위치 제약 가능 |',
          '| `Menu.Trigger` | 클릭 시 메뉴 토글 | children에 ref + onClick 자동 주입 |',
          '| `Menu.ContextArea` | 우클릭 시 메뉴 표시 | `followMouse` prop으로 마우스 추적 지원 |',
          '| `Menu.Content` | 메뉴 본체 (= Menu) | Flat API `<Menu items={...} />` 와 동일 |',
          '',
          '### MenuItem type (Figma Type 1:1 매핑)',
          '',
          'MenuItem의 `type` 필드가 Figma의 "Type" 속성과 1:1 매핑됩니다.',
          '각 type은 필요한 content props만 허용하고, 불필요한 props는 타입 레벨에서 차단합니다.',
          '',
          '| Figma Type | Code `type` | 필수 props | Size 제약 |',
          '|---|---|---|---|',
          '| Text Only | `text-only` | — | sm/md |',
          '| Icon Label | `icon-label` | `leadingIcon` | sm/md |',
          '| Shortcut | `shortcut` | `shortcutText` | sm/md |',
          '| Destructive | `destructive` | — | sm/md |',
          '| Submenu | `submenu` | `children` | sm/md |',
          '| Link | `link` | — | sm/md |',
          '| Checkbox | `checkbox` | — | sm/md |',
          '| Toggle | `toggle` | — | sm/md |',
          '| Selection | `selection` | — | sm/md |',
          '| Empty State | `empty-state` | — | sm/md |',
          '| Badge | `badge` | `badgeContent` | **md only** |',
          '| Profile | `profile` | `avatarContent`, `description` | **md only** |',
          '| Description | `description` | `description` | **md only** |',
          '| Icon Label Badge | `icon-label-badge` | `leadingIcon`, `badgeContent` | **md only** |',
          '| Checkbox Label Badge | `checkbox-label-badge` | `badgeContent` | **md only** |',
          '| Label Icon Badge | `label-icon-badge` | `closeTrailingIcon`, `badgeContent` | **md only** |',
          '| *(구분선)* | `divider` | — | sm/md |',
          '| *(섹션 제목)* | `heading` | `heading` | sm/md |',
          '',
          '### MenuItem 공통 props',
          '',
          '| Figma Property | Code Prop | 비고 |',
          '|---|---|---|',
          '| `menu` | `label` | Figma 레이어명은 `menu`이나, React 표준에 맞춰 `label`로 명명 |',
          '| `Disabled` | `disabled` | 비활성 상태 |',
          '| `Danger` | `danger` | destructive type에서 자동 적용, 수동 지정도 가능 |',
          '| `Selected` | `selected` | checkbox, toggle, selection에서 선택 상태 표시 |',
          '| `Dot Badge` | `dotBadge` | label 우측 상단에 dot badge 표시. 모든 type과 조합 가능 |',
          '',
          '> 개별 타입별 프리셋 스토리는 **Menu/MenuItem/Preset** 에서 확인하세요.',
          '',
          '---',
          '',
          '## API 사용 예시',
          '',
          '### 1. 버튼 클릭으로 메뉴 열기 (Compound Component)',
          '',
          '```tsx',
          'import { Menu, type MenuItem } from \'@aplus/ui\';',
          '',
          'const items: MenuItem[] = [',
          '  { type: \'icon-label\', id: \'1\', label: \'새 파일\', leadingIcon: <Icon name="add" /> },',
          '  { type: \'icon-label\', id: \'2\', label: \'파일 열기\', leadingIcon: <Icon name="post" /> },',
          '  { type: \'divider\' },',
          '  { type: \'destructive\', id: \'3\', label: \'삭제\' },',
          '];',
          '',
          '<Menu.Root>',
          '  <Menu.Trigger>',
          '    <Button label="메뉴 열기" />',
          '  </Menu.Trigger>',
          '  <Menu.Content items={items} onItemClick={(item) => console.log(item.id)} />',
          '</Menu.Root>',
          '```',
          '',
          '### 2. 우클릭 컨텍스트 메뉴',
          '',
          '```tsx',
          '<Menu.Root>',
          '  <Menu.ContextArea className="w-full h-full">',
          '    <div>이 영역에서 우클릭</div>',
          '  </Menu.ContextArea>',
          '  <Menu.Content items={items} />',
          '</Menu.Root>',
          '```',
          '',
          '### 3. 마우스 추적 컨텍스트 메뉴',
          '',
          '```tsx',
          'const followMouseOffset = { x: 12, y: 12 };',
          '',
          '<Menu.Root>',
          '  <Menu.ContextArea followMouse offset={followMouseOffset}>',
          '    <div>우클릭 후 마우스를 움직여보세요</div>',
          '  </Menu.ContextArea>',
          '  <Menu.Content items={items} />',
          '</Menu.Root>',
          '```',
          '',
          '### 4. 컨테이너 경계 제약',
          '',
          '```tsx',
          'const containerRef = useRef<HTMLDivElement>(null);',
          '',
          '<div ref={containerRef} className="w-[600px]">',
          '  <Menu.Root boundary={containerRef}>',
          '    <Menu.Trigger>',
          '      <Button label="메뉴 열기" />',
          '    </Menu.Trigger>',
          '    <Menu.Content items={items} />',
          '  </Menu.Root>',
          '</div>',
          '```',
          '',
          '### 5. MenuItem type별 데이터 작성',
          '',
          '```tsx',
          'const items: MenuItem[] = [',
          '  // 기본 텍스트',
          '  { type: \'text-only\', id: \'1\', label: \'기본 메뉴\' },',
          '',
          '  // 아이콘 + 레이블',
          '  { type: \'icon-label\', id: \'2\', label: \'새 파일\', leadingIcon: <Icon name="add" /> },',
          '',
          '  // 단축키',
          '  { type: \'shortcut\', id: \'3\', label: \'복사\', shortcutText: \'Ctrl+C\' },',
          '',
          '  // 서브메뉴',
          '  { type: \'submenu\', id: \'4\', label: \'최근 파일\', children: [',
          '    { type: \'text-only\', id: \'4-1\', label: \'document.txt\' },',
          '  ]},',
          '',
          '  // 외부 링크',
          '  { type: \'link\', id: \'5\', label: \'도움말\' },',
          '',
          '  // 체크박스 (다중 선택)',
          '  { type: \'checkbox\', id: \'6\', label: \'옵션 A\', selected: true },',
          '',
          '  // 토글 (체크 표시)',
          '  { type: \'toggle\', id: \'7\', label: \'자동 저장\', selected: true },',
          '',
          '  // 단일 선택',
          '  { type: \'selection\', id: \'8\', label: \'항목 선택\', selected: true },',
          '',
          '  // 위험 동작',
          '  { type: \'destructive\', id: \'9\', label: \'삭제\' },',
          '',
          '  // 배지 (md only)',
          '  { type: \'badge\', id: \'10\', label: \'알림\', badgeContent: <Badge>3</Badge> },',
          '',
          '  // 프로필 (md only)',
          '  { type: \'profile\', id: \'11\', label: \'홍길동\',',
          '    avatarContent: <Avatar />, description: \'hong@email.com\' },',
          '',
          '  // 부가설명 (md only)',
          '  { type: \'description\', id: \'12\', label: \'환경설정\',',
          '    description: \'앱 동작을 변경합니다\' },',
          '',
          '  // 구분선 & 섹션 제목',
          '  { type: \'divider\' },',
          '  { type: \'heading\', heading: \'섹션 이름\' },',
          '',
          '  // 공통 옵션 조합',
          '  { type: \'text-only\', id: \'13\', label: \'비활성\', disabled: true },',
          '  { type: \'text-only\', id: \'14\', label: \'알림 있음\', dotBadge: true },',
          '  { type: \'text-only\', id: \'15\', label: \'위험 텍스트\', danger: true },',
          '];',
          '```',
          '',
          '### 6. Flat API (Compound 없이 직접 사용)',
          '',
          '```tsx',
          '// 위치를 직접 지정하여 메뉴 렌더링',
          '<Menu',
          '  items={items}',
          '  size="md"',
          '  onItemClick={(item) => console.log(item.id)}',
          '  onClose={() => setOpen(false)}',
          '/>',
          '```',
        ].join('\n'),
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Menu>;

const sampleMenuData: MenuItem[] = [
  {
    type: 'icon-label',
    id: '1',
    label: '새 파일',
    leadingIcon: <Icon name="add" size={20} />,
  },
  {
    type: 'icon-label',
    id: '2',
    label: '파일 열기',
    leadingIcon: <Icon name="post" size={20} />,
  },
  { type: 'divider' },
  {
    type: 'icon-label',
    id: '3',
    label: '저장',
    leadingIcon: <Icon name="post" size={20} />,
  },
  {
    type: 'text-only',
    id: '4',
    label: '다른 이름으로 저장',
  },
  { type: 'divider' },
  {
    type: 'destructive',
    id: '5',
    label: '삭제',
  },
];

const wideMenuData: MenuItem[] = [
  {
    type: 'icon-label',
    id: '1',
    label: '매우 긴 메뉴 아이템 이름이 있는 첫 번째 항목',
    leadingIcon: <Icon name="add" size={20} />,
  },
  {
    type: 'icon-label',
    id: '2',
    label: '또 다른 긴 메뉴 아이템 설명이 포함된 두 번째 항목',
    leadingIcon: <Icon name="post" size={20} />,
  },
  {
    type: 'icon-label',
    id: '3',
    label: '매우매우 긴 텍스트를 가진 세 번째 메뉴 항목',
    leadingIcon: <Icon name="post" size={20} />,
  },
];

export const WithToggleButton: Story = {
  args: {
    size: 'md',
  },
  render: (args) => (
    <div className="flex h-[600px] items-start justify-center pt-8">
      <Menu.Root>
        <Menu.Trigger>
          <Button label="메뉴 열기" showStartIcon={false} showEndIcon={false} />
        </Menu.Trigger>
        <Menu.Content {...args} items={hierarchicalMenuData} />
      </Menu.Root>
    </div>
  ),
};

export const ContextMenu: Story = {
  args: {
    size: 'md',
  },
  render: (args) => (
    <div className="flex h-[400px] items-center justify-center">
      <Menu.Root>
        <Menu.ContextArea className="w-[400px] h-[300px] border-2 border-dashed border-gray-300 flex items-center justify-center rounded-lg bg-gray-50">
          <span className="text-sm text-gray-500">이 영역에서 우클릭하세요</span>
        </Menu.ContextArea>
        <Menu.Content {...args} items={sampleMenuData} />
      </Menu.Root>
    </div>
  ),
};

const followMouseOffset = { x: 12, y: 12 };

export const FollowMouseContextMenu: Story = {
  args: {
    size: 'md',
  },
  render: (args) => (
    <div className="flex h-[400px] items-center justify-center">
      <Menu.Root>
        <Menu.ContextArea
          followMouse
          offset={followMouseOffset}
          className="w-[400px] h-[300px] border-2 border-dashed border-blue-400 flex items-center justify-center rounded-lg bg-blue-50"
        >
          <span className="text-sm text-blue-500">우클릭 후 마우스를 움직여보세요 (offset: 12px)</span>
        </Menu.ContextArea>
        <Menu.Content {...args} items={sampleMenuData} />
      </Menu.Root>
    </div>
  ),
};

export const MenuPositioningInContainer: Story = {
  args: {
    size: 'md',
  },
  render: (args) => {
    const containerRef = React.useRef<HTMLDivElement>(null);

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
              <Menu.Root boundary={containerRef}>
                <Menu.Trigger>
                  <Button
                    label="좁은 메뉴 열기"
                    showStartIcon={false}
                    showEndIcon={false}
                  />
                </Menu.Trigger>
                <Menu.Content {...args} items={sampleMenuData} />
              </Menu.Root>
            </div>
          </div>

          {/* 넓은 메뉴 */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-700">2. 넓은 메뉴 (컨테이너 오른쪽을 넘어가면 오른쪽 맞춤)</span>
            </div>
            <div className="flex justify-end pr-[100px]">
              <Menu.Root boundary={containerRef}>
                <Menu.Trigger>
                  <Button
                    label="넓은 메뉴 열기"
                    showStartIcon={false}
                    showEndIcon={false}
                  />
                </Menu.Trigger>
                <Menu.Content {...args} items={wideMenuData} />
              </Menu.Root>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

const headingMenuData: MenuItem[] = [
  { type: 'heading', heading: '파일' },
  { type: 'icon-label', id: 'h-1', label: '새 파일', leadingIcon: <Icon name="add" size={20} /> },
  { type: 'icon-label', id: 'h-2', label: '파일 열기', leadingIcon: <Icon name="post" size={20} /> },
  { type: 'divider' },
  { type: 'heading', heading: '편집' },
  { type: 'shortcut', id: 'h-3', label: '복사', shortcutText: 'Ctrl+C' },
  { type: 'shortcut', id: 'h-4', label: '붙여넣기', shortcutText: 'Ctrl+V' },
  { type: 'divider' },
  { type: 'heading', heading: '기타' },
  { type: 'destructive', id: 'h-5', label: '삭제' },
];

export const WithHeadingAndDivider: Story = {
  args: { size: 'md' },
  render: (args) => (
    <div className="flex gap-8 p-8">
      <div>
        <div className="text-caption-xs-regular text-text-tertiary mb-2">md</div>
        <Menu {...args} size="md" items={headingMenuData} className="w-[240px]" />
      </div>
      <div>
        <div className="text-caption-xs-regular text-text-tertiary mb-2">sm</div>
        <Menu {...args} size="sm" items={headingMenuData} className="w-[240px]" />
      </div>
    </div>
  ),
};
