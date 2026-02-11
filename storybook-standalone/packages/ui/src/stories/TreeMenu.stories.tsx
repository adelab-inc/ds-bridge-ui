import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  TreeMenu,
  TreeMenuItemData,
  TreeMenuItemDataSm,
  TreeMenuItemDataMd,
  DropPosition,
} from '../components/TreeMenu';
import { Item as TreeMenuItem } from '../components/TreeMenu/Item';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';
import { Field } from '../components/Field';
import { Button } from '../components/Button';

/**
 * TreeMenu 스토리용 wrapper 스타일
 * TreeMenu 컴포넌트 자체는 레이아웃만 담당하고, 시각적 스타일은 wrapper에서 제공
 */
const treeMenuWrapperClass = 'min-w-[200px] max-w-[400px] py-component-inset-menu-y px-component-inset-menu-x items-stretch rounded-lg border border-border-default bg-bg-surface shadow-[0_2px_4px_0_rgba(0,0,0,0.16)]';

const meta: Meta<typeof TreeMenu> = {
  title: 'UI/TreeMenu',
  component: TreeMenu,
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      // noWrapper 파라미터가 true면 wrapper 없이 렌더링
      if (context.parameters?.noWrapper) {
        return <Story />;
      }
      return (
        <div className={treeMenuWrapperClass}>
          <Story />
        </div>
      );
    },
  ],
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md'],
      description: 'TreeMenu size variant',
    },
    items: { table: { disable: true } },
    checkboxMode: { table: { disable: true } },
    checkedIds: { table: { disable: true } },
    onCheckChange: { table: { disable: true } },
    onItemClick: { table: { disable: true } },
    defaultExpandedIds: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof TreeMenu>;

// SM/MD 공용 기본 아이템 (badge 없음)
const basicItems: TreeMenuItemDataMd[] = [
  {
    id: 'folder-1',
    label: '프로젝트',
    children: [
      { id: 'file-1', label: '문서.txt' },
      { id: 'file-2', label: '이미지.png' },
    ],
  },
  {
    id: 'folder-2',
    label: '설정',
    children: [
      { id: 'file-3', label: '환경설정.json' },
    ],
  },
  { id: 'file-4', label: '읽어보세요.md' },
];

// SM용 기본 아이템
const basicSmItems: TreeMenuItemDataSm[] = [
  {
    id: 'folder-1',
    label: '프로젝트',
    children: [
      { id: 'file-1', label: '문서.txt' },
      { id: 'file-2', label: '이미지.png' },
    ],
  },
  {
    id: 'folder-2',
    label: '설정',
    children: [
      { id: 'file-3', label: '환경설정.json' },
    ],
  },
  { id: 'file-4', label: '읽어보세요.md' },
];

// MD 전용: 뱃지 포함 아이템
const itemsWithBadge: TreeMenuItemDataMd[] = [
  {
    id: 'inbox',
    label: '받은 편지함',
    badge: <Badge type="count">12</Badge>,
    children: [
      { id: 'unread', label: '읽지 않음', badge: <Badge type="dot" position="top-right" />, badgeDot: true },
      { id: 'starred', label: '중요', badge: <Badge type="count">3</Badge> },
    ],
  },
  {
    id: 'sent',
    label: '보낸 편지함',
    badge: <Badge type="dot" position="top-right" />,
    badgeDot: true,
  },
  {
    id: 'drafts',
    label: '임시 보관함',
    badge: <Badge type="count">3</Badge>,
  },
];

const itemsWithHoverAction: TreeMenuItemDataMd[] = [
  {
    id: 'workspace',
    label: '워크스페이스',
    hoverActionIcon: <Icon name="plus" size={16} />,
    onHoverActionClick: () => console.log('🎯 [HoverAction] "워크스페이스" hover 아이콘 클릭'),
    children: [
      {
        id: 'project-1',
        label: '프로젝트 A',
        hoverActionIcon: <Icon name="plus" size={16} />,
        onHoverActionClick: () => console.log('🎯 [HoverAction] "프로젝트 A" hover 아이콘 클릭'),
      },
      {
        id: 'project-2',
        label: '프로젝트 B',
        hoverActionIcon: <Icon name="plus" size={16} />,
        onHoverActionClick: () => console.log('🎯 [HoverAction] "프로젝트 B" hover 아이콘 클릭'),
      },
    ],
  },
];

const deepNestedItems: TreeMenuItemDataMd[] = [
  {
    id: 'level-1',
    label: '1단계',
    children: [
      {
        id: 'level-2',
        label: '2단계',
        children: [
          {
            id: 'level-3',
            label: '3단계',
          },
          {
            id: 'level-3-2',
            label: '3단계 (2)',
          },
        ],
      },
    ],
  },
];

const disabledItems: TreeMenuItemDataMd[] = [
  { id: 'active', label: '활성 항목' },
  { id: 'disabled', label: '비활성 항목', disabled: true },
  {
    id: 'folder',
    label: '폴더',
    children: [
      { id: 'child-active', label: '활성 자식' },
      { id: 'child-disabled', label: '비활성 자식', disabled: true },
    ],
  },
];

// 미리 정의된 액션 핸들러 (Storybook 직렬화 문제 방지)
// 각 이벤트 핸들러가 동작할 때 어떤 이벤트인지 콘솔에서 확인 가능
const handleHoverAction = () => console.log('🎯 [HoverAction] hover 액션 아이콘 클릭');
const handleItemClick = () => console.log('📌 [ItemClick] 행 클릭 (텍스트/뱃지/빈 공간)');
const handleExpandToggle = (label: string, isExpanded: boolean) =>
  console.log(`🔽 [ExpandToggle] "${label}" ${isExpanded ? '접힘' : '펼침'}`);
const handleCheckChange = (label: string, checked: boolean) =>
  console.log(`☑️ [CheckChange] "${label}" 체크박스 ${checked ? '체크됨' : '해제됨'}`);

// SingleTreeMenuItem용 Wrapper 컴포넌트 (Storybook 직렬화 문제 방지)
interface SingleTreeMenuItemWrapperProps {
  size: 'sm' | 'md';
  label: string;
  hasExpandIcon: boolean;
  isExpanded: boolean;
  showCheckbox: boolean;
  checkState: 'unchecked' | 'checked' | 'indeterminate';
  badgeType: 'none' | 'count' | 'dot';
  badgeCount: number;
  showHoverAction: boolean;
  disabled: boolean;
}

function SingleTreeMenuItemWrapper(props: SingleTreeMenuItemWrapperProps) {
  const [checkState, setCheckState] = React.useState(props.checkState);
  const [isExpanded, setIsExpanded] = React.useState(props.isExpanded);

  React.useEffect(() => {
    setCheckState(props.checkState);
  }, [props.checkState]);

  React.useEffect(() => {
    setIsExpanded(props.isExpanded);
  }, [props.isExpanded]);

  // MD 사이즈일 때만 badge, checkbox 적용
  const isMdSize = props.size === 'md';

  // 뱃지 생성 (MD only)
  let badge: React.ReactNode = undefined;
  if (isMdSize && props.badgeType === 'count') {
    badge = <Badge type="count">{props.badgeCount}</Badge>;
  } else if (isMdSize && props.badgeType === 'dot') {
    badge = <Badge type="dot" position="top-right" />;
  }

  // SM 사이즈일 때
  if (props.size === 'sm') {
    const smItem: TreeMenuItemDataSm = {
      id: 'single-item',
      label: props.label,
      hoverActionIcon: props.showHoverAction ? <Icon name="plus" size={16} /> : undefined,
      onHoverActionClick: props.showHoverAction ? handleHoverAction : undefined,
      disabled: props.disabled,
      children: props.hasExpandIcon ? [{ id: 'child', label: '자식 아이템' }] : undefined,
    };

    return (
      <TreeMenuItem
        item={smItem}
        size="sm"
        depth={1}
        hasChildren={props.hasExpandIcon}
        isExpanded={isExpanded}
        onExpandToggle={() => {
          handleExpandToggle(props.label, isExpanded);
          setIsExpanded(prev => !prev);
        }}
        onItemClick={handleItemClick}
      />
    );
  }

  // MD 사이즈일 때
  const mdItem: TreeMenuItemDataMd = {
    id: 'single-item',
    label: props.label,
    badge,
    badgeDot: props.badgeType === 'dot',
    hoverActionIcon: props.showHoverAction ? <Icon name="plus" size={16} /> : undefined,
    onHoverActionClick: props.showHoverAction ? handleHoverAction : undefined,
    disabled: props.disabled,
    children: props.hasExpandIcon ? [{ id: 'child', label: '자식 아이템' }] : undefined,
  };

  return (
    <TreeMenuItem
      item={mdItem}
      size="md"
      depth={1}
      hasChildren={props.hasExpandIcon}
      isExpanded={isExpanded}
      checkboxMode={props.showCheckbox}
      checkState={checkState === 'unchecked' ? null : checkState}
      onExpandToggle={() => {
        handleExpandToggle(props.label, isExpanded);
        setIsExpanded(prev => !prev);
      }}
      onCheckChange={(checked) => {
        handleCheckChange(props.label, checked);
        setCheckState(checked ? 'checked' : 'unchecked');
      }}
      onItemClick={handleItemClick}
    />
  );
}

/**
 * 기본 TreeMenu (size control로 sm/md 전환 가능)
 */
export const Default: Story = {
  render: (args) => {
    const handleClick = (item: TreeMenuItemDataMd | TreeMenuItemDataSm) => {
      console.log(`📌 [ItemClick] "${item.label}" 행 클릭`);
    };

    const handleExpandToggle = (id: string, isExpanded: boolean) => {
      console.log(`🔽 [ExpandToggle] id="${id}" ${isExpanded ? '펼침' : '접힘'}`);
    };

    // size에 따라 적절한 items 사용
    if (args.size === 'sm') {
      return <TreeMenu size="sm" items={basicSmItems} onItemClick={handleClick} onExpandToggle={handleExpandToggle} />;
    }
    return <TreeMenu size="md" items={basicItems} onItemClick={handleClick} onExpandToggle={handleExpandToggle} />;
  },
  args: {
    size: 'md',
  },
};

/**
 * 체크박스 모드 (MD only)
 */
export const WithCheckbox: Story = {
  render: () => {
    const [checkedIds, setCheckedIds] = React.useState<Set<string>>(new Set());

    const handleCheck = (id: string, checked: boolean, affectedIds: string[]) => {
      console.log(`☑️ [CheckChange] id="${id}" ${checked ? '체크됨' : '해제됨'}, 영향받은 항목: [${affectedIds.join(', ')}]`);
      setCheckedIds(prev => {
        const next = new Set(prev);
        if (checked) {
          affectedIds.forEach(aid => next.add(aid));
        } else {
          affectedIds.forEach(aid => next.delete(aid));
        }
        return next;
      });
    };

    const handleClick = (item: TreeMenuItemDataMd) => {
      console.log(`📌 [ItemClick] "${item.label}" 행 클릭`);
    };

    const handleExpandToggle = (id: string, isExpanded: boolean) => {
      console.log(`🔽 [ExpandToggle] id="${id}" ${isExpanded ? '펼침' : '접힘'}`);
    };

    return (
      <TreeMenu
        items={basicItems}
        checkboxMode={true}
        checkedIds={checkedIds}
        onCheckChange={handleCheck}
        onItemClick={handleClick}
        onExpandToggle={handleExpandToggle}
      />
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};

/**
 * 뱃지 포함 (MD only - count + dot)
 */
export const WithBadge: Story = {
  render: () => {
    const handleClick = (item: TreeMenuItemDataMd) => {
      console.log(`📌 [ItemClick] "${item.label}" 행 클릭 (뱃지 포함)`);
    };

    const handleExpandToggle = (id: string, isExpanded: boolean) => {
      console.log(`🔽 [ExpandToggle] id="${id}" ${isExpanded ? '펼침' : '접힘'}`);
    };

    return (
      <TreeMenu
        items={itemsWithBadge}
        defaultExpandedIds={new Set(['inbox'])}
        onItemClick={handleClick}
        onExpandToggle={handleExpandToggle}
      />
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};

/**
 * Hover 액션 아이콘
 */
export const WithHoverAction: Story = {
  render: () => {
    const handleClick = (item: TreeMenuItemDataMd) => {
      console.log(`📌 [ItemClick] "${item.label}" 행 클릭`);
    };

    const handleExpandToggle = (id: string, isExpanded: boolean) => {
      console.log(`🔽 [ExpandToggle] id="${id}" ${isExpanded ? '펼침' : '접힘'}`);
    };

    return (
      <TreeMenu
        items={itemsWithHoverAction}
        defaultExpandedIds={new Set(['workspace'])}
        onItemClick={handleClick}
        onExpandToggle={handleExpandToggle}
      />
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};

/**
 * 3단계 깊이
 */
export const DeepNested: Story = {
  render: () => {
    const handleClick = (item: TreeMenuItemDataMd) => {
      console.log(`📌 [ItemClick] "${item.label}" 행 클릭`);
    };

    const handleExpandToggle = (id: string, isExpanded: boolean) => {
      console.log(`🔽 [ExpandToggle] id="${id}" ${isExpanded ? '펼침' : '접힘'}`);
    };

    return (
      <TreeMenu
        items={deepNestedItems}
        defaultExpandedIds={new Set(['level-1', 'level-2'])}
        onItemClick={handleClick}
        onExpandToggle={handleExpandToggle}
      />
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};

/**
 * 비활성 항목
 */
export const WithDisabled: Story = {
  render: () => {
    const handleClick = (item: TreeMenuItemDataMd) => {
      console.log(`📌 [ItemClick] "${item.label}" 행 클릭`);
    };

    const handleExpandToggle = (id: string, isExpanded: boolean) => {
      console.log(`🔽 [ExpandToggle] id="${id}" ${isExpanded ? '펼침' : '접힘'}`);
    };

    return (
      <TreeMenu
        items={disabledItems}
        defaultExpandedIds={new Set(['folder'])}
        onItemClick={handleClick}
        onExpandToggle={handleExpandToggle}
      />
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};

/**
 * 체크박스 + 뱃지 조합 (MD only)
 */
export const CheckboxWithBadge: Story = {
  render: () => {
    const [checkedIds, setCheckedIds] = React.useState<Set<string>>(new Set(['unread']));

    const handleCheckChange = (id: string, checked: boolean, affectedIds: string[]) => {
      console.log(`☑️ [CheckChange] id="${id}" ${checked ? '체크됨' : '해제됨'}, 영향받은 항목: [${affectedIds.join(', ')}]`);
      setCheckedIds(prev => {
        const next = new Set(prev);
        if (checked) {
          affectedIds.forEach(aid => next.add(aid));
        } else {
          affectedIds.forEach(aid => next.delete(aid));
        }
        return next;
      });
    };

    const handleClick = (item: TreeMenuItemDataMd) => {
      console.log(`📌 [ItemClick] "${item.label}" 행 클릭 (체크박스+뱃지)`);
    };

    const handleExpandToggle = (id: string, isExpanded: boolean) => {
      console.log(`🔽 [ExpandToggle] id="${id}" ${isExpanded ? '펼침' : '접힘'}`);
    };

    return (
      <TreeMenu
        items={itemsWithBadge}
        checkboxMode={true}
        checkedIds={checkedIds}
        onCheckChange={handleCheckChange}
        defaultExpandedIds={new Set(['inbox'])}
        onItemClick={handleClick}
        onExpandToggle={handleExpandToggle}
      />
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};

/**
 * 단일 TreeMenu Item - Control 패널로 모든 속성 조절 가능
 */
export const SingleTreeMenuItem: StoryObj<{
  size: 'sm' | 'md';
  label: string;
  hasExpandIcon: boolean;
  isExpanded: boolean;
  showCheckbox: boolean;
  checkState: 'unchecked' | 'checked' | 'indeterminate';
  badgeType: 'none' | 'count' | 'dot';
  badgeCount: number;
  showHoverAction: boolean;
  disabled: boolean;
}> = {
  // Storybook docs 직렬화 비활성화 (React 요소/함수 포함된 item prop 때문)
  parameters: {
    docs: {
      source: {
        type: 'code',
      },
    },
  },
  argTypes: {
    size: {
      control: { type: 'select' },
      options: ['sm', 'md'],
      description: '사이즈 (SM에서는 checkbox/badge 무시됨)',
    },
    label: {
      control: { type: 'text' },
      description: '레이블 텍스트',
    },
    hasExpandIcon: {
      control: { type: 'boolean' },
      description: '펼침 아이콘 (>) 표시',
    },
    isExpanded: {
      control: { type: 'boolean' },
      description: '펼침 상태 (hasExpandIcon이 true일 때)',
    },
    showCheckbox: {
      control: { type: 'boolean' },
      description: '체크박스 표시 (MD only)',
    },
    checkState: {
      control: { type: 'select' },
      options: ['unchecked', 'checked', 'indeterminate'],
      description: '체크 상태 (MD only)',
    },
    badgeType: {
      control: { type: 'select' },
      options: ['none', 'count', 'dot'],
      description: '뱃지 타입 (MD only)',
    },
    badgeCount: {
      control: { type: 'number', min: 0, max: 999 },
      description: '뱃지 숫자 (count 타입일 때, MD only)',
    },
    showHoverAction: {
      control: { type: 'boolean' },
      description: 'Hover 액션 아이콘 표시',
    },
    disabled: {
      control: { type: 'boolean' },
      description: '비활성 상태',
    },
  },
  args: {
    size: 'md',
    label: '메뉴 아이템',
    hasExpandIcon: false,
    isExpanded: false,
    showCheckbox: false,
    checkState: 'unchecked',
    badgeType: 'none',
    badgeCount: 5,
    showHoverAction: false,
    disabled: false,
  },
  render: function SingleTreeMenuItemRender(args) {
    return <SingleTreeMenuItemWrapper {...args} />;
  },
};

/**
 * Controlled 모드 - 외부에서 펼침 상태 제어
 * expandedIds + onExpandChange를 사용하여 "모두 펼치기/접기" 버튼으로 외부 제어
 */
export const ControlledExpandState: Story = {
  parameters: {
    noWrapper: true,
  },
  render: () => {
    const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set(['folder-1']));

    // 모든 폴더 ID 수집
    const getAllFolderIds = (items: TreeMenuItemDataMd[]): string[] => {
      const ids: string[] = [];
      const traverse = (nodes: TreeMenuItemDataMd[]) => {
        for (const node of nodes) {
          if (node.children && node.children.length > 0) {
            ids.push(node.id);
            traverse(node.children);
          }
        }
      };
      traverse(items);
      return ids;
    };

    const allFolderIds = getAllFolderIds(basicItems);

    const handleExpandAll = () => {
      setExpandedIds(new Set(allFolderIds));
      console.log('📂 [ControlledMode] 모두 펼침');
    };

    const handleCollapseAll = () => {
      setExpandedIds(new Set());
      console.log('📁 [ControlledMode] 모두 접힘');
    };

    const handleItemClick = (item: TreeMenuItemDataMd) => {
      console.log(`📌 [ItemClick] "${item.label}" 행 클릭`);
    };

    return (
      <div className="flex flex-col gap-4">
        {/* 외부 제어 버튼 */}
        <div className="flex gap-2">
          <Button size="sm" variant="primary" onClick={handleExpandAll}>
            모두 펼치기
          </Button>
          <Button size="sm" variant="outline" onClick={handleCollapseAll}>
            모두 접기
          </Button>
        </div>

        {/* 현재 상태 표시 */}
        <div className="text-xs text-text-tertiary">
          펼쳐진 항목: {expandedIds.size > 0 ? Array.from(expandedIds).join(', ') : '(없음)'}
        </div>

        {/* TreeMenu - Controlled 모드 */}
        <div className={treeMenuWrapperClass}>
          <TreeMenu
            items={basicItems}
            expandedIds={expandedIds}
            onExpandChange={setExpandedIds}
            onItemClick={handleItemClick}
          />
        </div>
      </div>
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};

/**
 * 조직도 더미 데이터 (스크롤 테스트용 - 640px 초과, 뱃지/체크박스 포함)
 */
const organizationItems: TreeMenuItemDataMd[] = [
  {
    id: 'company',
    label: '전사',
    badge: <Badge type="count">128</Badge>,
    children: [
      {
        id: 'sales',
        label: '영업부문',
        badge: <Badge type="count">45</Badge>,
        hoverActionIcon: <Icon name="plus" size={16} />,
        onHoverActionClick: () => console.log('🎯 [HoverAction] "영업부문" 하위 조직 추가'),
        children: [
          {
            id: 'seoul-hq',
            label: '수도권사업본부',
            badge: <Badge type="dot" position="top-right" />,
            badgeDot: true,
            hoverActionIcon: <Icon name="plus" size={16} />,
            onHoverActionClick: () => console.log('🎯 [HoverAction] "수도권사업본부" 하위 지점 추가'),
            children: [
              { id: 'gangnam', label: '강남지점', badge: <Badge type="count">8</Badge> },
              { id: 'seocho', label: '서초지점', hoverActionIcon: <Icon name="more-vert" size={16} />, onHoverActionClick: () => console.log('🎯 [HoverAction] "서초지점" 편집') },
              { id: 'songpa', label: '송파지점', badge: <Badge type="dot" position="top-right" />, badgeDot: true },
              { id: 'gangdong', label: '강동지점' },
            ],
          },
          {
            id: 'gangnam-hq',
            label: '강남사업본부',
            children: [
              { id: 'yeoksam', label: '역삼지점', badge: <Badge type="count">5</Badge> },
              { id: 'samseong', label: '삼성지점' },
              { id: 'daechi', label: '대치지점', hoverActionIcon: <Icon name="more-vert" size={16} />, onHoverActionClick: () => console.log('🎯 [HoverAction] "대치지점" 편집') },
            ],
          },
          {
            id: 'gyeonggi-hq',
            label: '경기사업본부',
            badge: <Badge type="count">12</Badge>,
            children: [
              { id: 'bundang', label: '분당지점' },
              { id: 'suji', label: '수지지점', badge: <Badge type="dot" position="top-right" />, badgeDot: true },
              { id: 'yongin', label: '용인지점' },
              { id: 'suwon', label: '수원지점', badge: <Badge type="count">3</Badge> },
            ],
          },
        ],
      },
      {
        id: 'tech',
        label: '기술부문',
        badge: <Badge type="count">52</Badge>,
        hoverActionIcon: <Icon name="plus" size={16} />,
        onHoverActionClick: () => console.log('🎯 [HoverAction] "기술부문" 하위 센터 추가'),
        children: [
          {
            id: 'dev-center',
            label: '개발센터',
            badge: <Badge type="dot" position="top-right" />,
            badgeDot: true,
            hoverActionIcon: <Icon name="plus" size={16} />,
            onHoverActionClick: () => console.log('🎯 [HoverAction] "개발센터" 하위 팀 추가'),
            children: [
              { id: 'frontend', label: '프론트엔드팀', badge: <Badge type="count">12</Badge>, hoverActionIcon: <Icon name="more-vert" size={16} />, onHoverActionClick: () => console.log('🎯 [HoverAction] "프론트엔드팀" 편집') },
              { id: 'backend', label: '백엔드팀', badge: <Badge type="count">15</Badge> },
              { id: 'mobile', label: '모바일팀', hoverActionIcon: <Icon name="more-vert" size={16} />, onHoverActionClick: () => console.log('🎯 [HoverAction] "모바일팀" 편집') },
              { id: 'devops', label: 'DevOps팀', badge: <Badge type="dot" position="top-right" />, badgeDot: true },
            ],
          },
          {
            id: 'infra-center',
            label: '인프라센터',
            hoverActionIcon: <Icon name="plus" size={16} />,
            onHoverActionClick: () => console.log('🎯 [HoverAction] "인프라센터" 하위 팀 추가'),
            children: [
              { id: 'network', label: '네트워크팀' },
              { id: 'security', label: '보안팀', badge: <Badge type="count">7</Badge> },
              { id: 'cloud', label: '클라우드팀' },
            ],
          },
        ],
      },
      {
        id: 'management',
        label: '경영지원부문',
        badge: <Badge type="count">31</Badge>,
        children: [
          {
            id: 'hr',
            label: '인사팀',
            badge: <Badge type="dot" position="top-right" />,
            badgeDot: true,
            children: [
              { id: 'recruit', label: '채용파트', badge: <Badge type="count">4</Badge> },
              { id: 'training', label: '교육파트' },
              { id: 'welfare', label: '복지파트' },
            ],
          },
          {
            id: 'finance',
            label: '재무팀',
            children: [
              { id: 'accounting', label: '회계파트', badge: <Badge type="dot" position="top-right" />, badgeDot: true },
              { id: 'tax', label: '세무파트' },
            ],
          },
          {
            id: 'general',
            label: '총무팀',
            badge: <Badge type="count">6</Badge>,
            children: [
              { id: 'facility', label: '시설관리파트' },
              { id: 'procurement', label: '구매파트' },
            ],
          },
        ],
      },
    ],
  },
];

/**
 * 섹션 내 TreeMenu - 조직도 예시
 * Section 컨테이너 안에 Heading, Field(검색), TreeMenu가 포함된 실제 사용 패턴
 * 뱃지(count/dot), 체크박스 모드 포함
 */
export const InSection: Story = {
  parameters: {
    noWrapper: true, // 기본 treeMenuWrapperClass 제거
  },
  render: () => {
    const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
      new Set(['company', 'sales', 'tech', 'management'])
    );
    const [checkedIds, setCheckedIds] = React.useState<Set<string>>(
      new Set(['frontend', 'backend']) // 초기 체크 상태
    );

    const handleExpandToggle = (id: string, isExpanded: boolean) => {
      setExpandedIds(prev => {
        const next = new Set(prev);
        if (isExpanded) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
    };

    const handleCheckChange = (id: string, checked: boolean, affectedIds: string[]) => {
      console.log(`☑️ [CheckChange] id="${id}" ${checked ? '체크됨' : '해제됨'}, 영향받은 항목: [${affectedIds.join(', ')}]`);
      setCheckedIds(prev => {
        const next = new Set(prev);
        if (checked) {
          affectedIds.forEach(aid => next.add(aid));
        } else {
          affectedIds.forEach(aid => next.delete(aid));
        }
        return next;
      });
    };

    const handleItemClick = (item: TreeMenuItemDataMd) => {
      console.log(`📌 [ItemClick] "${item.label}" 선택됨`);
    };

    return (
      <section
        className="flex flex-col items-start w-[338px] py-component-inset-panel-y px-component-inset-panel-x gap-component-gap-field-group-y bg-bg-surface border border-border-default rounded-lg"
      >
        {/* Heading */}
        <h2 className="text-text-primary text-heading-md-semibold">
          조직도
        </h2>

        {/* Search Field */}
        <Field
          placeholder="조직명 입력"
          size="md"
          endIcon={<Icon name="search" size={20} />}
          className="w-full"
        />

        {/* TreeMenu with Checkbox + Badge */}
        <TreeMenu
          items={organizationItems}
          defaultExpandedIds={expandedIds}
          checkboxMode={true}
          checkedIds={checkedIds}
          onCheckChange={handleCheckChange}
          onExpandToggle={handleExpandToggle}
          onItemClick={handleItemClick}
          className="w-full"
        />
      </section>
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};

/**
 * 트리 아이템 이동 유틸리티 함수
 * 드래그한 아이템을 대상 위치로 이동시킵니다.
 */
const moveTreeItem = (
  items: TreeMenuItemDataMd[],
  draggedId: string,
  targetId: string,
  position: DropPosition
): TreeMenuItemDataMd[] => {
  // 깊은 복사
  const cloneItems = (arr: TreeMenuItemDataMd[]): TreeMenuItemDataMd[] =>
    arr.map(item => ({
      ...item,
      children: item.children ? cloneItems(item.children) : undefined,
    }));

  const cloned = cloneItems(items);

  // 드래그한 아이템 찾기 및 제거
  let draggedItem: TreeMenuItemDataMd | null = null;

  const removeItem = (arr: TreeMenuItemDataMd[], id: string): TreeMenuItemDataMd[] => {
    return arr.filter(item => {
      if (item.id === id) {
        draggedItem = { ...item, children: item.children ? cloneItems(item.children) : undefined };
        return false;
      }
      if (item.children) {
        item.children = removeItem(item.children, id);
      }
      return true;
    });
  };

  const result = removeItem(cloned, draggedId);
  if (!draggedItem) return items;

  // 대상 위치에 삽입
  const insertItem = (arr: TreeMenuItemDataMd[]): boolean => {
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].id === targetId) {
        if (position === 'before') {
          arr.splice(i, 0, draggedItem!);
        } else if (position === 'after') {
          arr.splice(i + 1, 0, draggedItem!);
        } else if (position === 'inside') {
          if (!arr[i].children) {
            arr[i].children = [];
          }
          arr[i].children!.push(draggedItem!);
        }
        return true;
      }
      if (arr[i].children && insertItem(arr[i].children!)) {
        return true;
      }
    }
    return false;
  };

  insertItem(result);
  return result;
};

/**
 * 드래그 앤 드롭 - 조직도 아이템 순서 및 계층 변경
 * - 아이템을 드래그하여 다른 위치로 이동
 * - 위/아래로 드롭: 순서 변경
 * - 가운데로 드롭: 해당 아이템의 하위로 이동
 */
export const Draggable: Story = {
  parameters: {
    noWrapper: true,
  },
  render: () => {
    // 간단한 드래그 테스트용 데이터
    const initialItems: TreeMenuItemDataMd[] = [
      {
        id: 'sales',
        label: '영업부문',
        children: [
          { id: 'seoul-hq', label: '수도권사업본부' },
          { id: 'gangnam-hq', label: '강남사업본부' },
          { id: 'gyeonggi-hq', label: '경기사업본부' },
        ],
      },
      {
        id: 'tech',
        label: '기술부문',
        children: [
          { id: 'dev-center', label: '개발센터' },
          { id: 'infra-center', label: '인프라센터' },
        ],
      },
      {
        id: 'management',
        label: '경영지원부문',
        children: [
          { id: 'hr', label: '인사팀' },
          { id: 'finance', label: '재무팀' },
        ],
      },
    ];

    const [items, setItems] = React.useState<TreeMenuItemDataMd[]>(initialItems);
    const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
      new Set(['sales', 'tech', 'management'])
    );

    const handleItemMove = (draggedId: string, targetId: string, position: DropPosition) => {
      console.log(`🔀 [Drag & Drop] "${draggedId}" → "${targetId}" (${position})`);
      setItems(prev => moveTreeItem(prev, draggedId, targetId, position));
    };

    const handleReset = () => {
      setItems(initialItems);
      console.log('🔄 [Reset] 초기 상태로 복원');
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={handleReset}>
            초기화
          </Button>
        </div>
        <p className="text-sm text-text-secondary">
          아이템을 드래그하여 순서를 변경하거나 다른 아이템 안으로 이동할 수 있습니다.
        </p>
        <div className={treeMenuWrapperClass}>
          <TreeMenu
            items={items}
            expandedIds={expandedIds}
            onExpandChange={setExpandedIds}
            draggable={true}
            onItemMove={handleItemMove}
          />
        </div>
      </div>
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};

/**
 * 드래그 앤 드롭 - 긴 목록 (자동 스크롤 테스트용)
 * - 스크롤이 필요한 긴 목록에서 드래그 시 자동 스크롤 테스트
 * - 컨테이너: max-h-[640px] overflow-y-auto
 */
export const DraggableLongList: Story = {
  parameters: {
    noWrapper: true,
  },
  render: () => {
    // 긴 목록 생성 함수
    const generateLongList = (): TreeMenuItemDataMd[] => {
      const departments = ['영업', '기술', '인사', '재무', '마케팅', '연구', '생산', '품질', '물류', '고객지원'];
      const result: TreeMenuItemDataMd[] = [];

      departments.forEach((dept, deptIdx) => {
        const teams: TreeMenuItemDataMd[] = [];
        // 각 부서당 5개 팀
        for (let t = 1; t <= 5; t++) {
          const members: TreeMenuItemDataMd[] = [];
          // 각 팀당 4명
          for (let m = 1; m <= 4; m++) {
            members.push({
              id: `dept-${deptIdx}-team-${t}-member-${m}`,
              label: `${dept}${t}팀 직원${m}`,
            });
          }
          teams.push({
            id: `dept-${deptIdx}-team-${t}`,
            label: `${dept}${t}팀`,
            children: members,
          });
        }
        result.push({
          id: `dept-${deptIdx}`,
          label: `${dept}부문`,
          children: teams,
        });
      });

      return result;
    };

    const [items, setItems] = React.useState<TreeMenuItemDataMd[]>(() => generateLongList());
    // 처음 3개 부서만 펼침
    const [expandedIds, setExpandedIds] = React.useState<Set<string>>(
      new Set(['dept-0', 'dept-1', 'dept-2', 'dept-0-team-1', 'dept-0-team-2', 'dept-1-team-1'])
    );

    const handleItemMove = (draggedId: string, targetId: string, position: DropPosition) => {
      console.log(`🔀 [Drag & Drop] "${draggedId}" → "${targetId}" (${position})`);
      setItems(prev => moveTreeItem(prev, draggedId, targetId, position));
    };

    const handleExpandAll = () => {
      const allIds: string[] = [];
      const collect = (nodes: TreeMenuItemDataMd[]) => {
        nodes.forEach(node => {
          if (node.children && node.children.length > 0) {
            allIds.push(node.id);
            collect(node.children);
          }
        });
      };
      collect(items);
      setExpandedIds(new Set(allIds));
    };

    const handleCollapseAll = () => {
      setExpandedIds(new Set());
    };

    const handleReset = () => {
      setItems(generateLongList());
      setExpandedIds(new Set(['dept-0', 'dept-1', 'dept-2', 'dept-0-team-1', 'dept-0-team-2', 'dept-1-team-1']));
      console.log('🔄 [Reset] 초기 상태로 복원');
    };

    return (
      <div className="flex flex-col gap-4">
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="primary" onClick={handleExpandAll}>
            모두 펼치기
          </Button>
          <Button size="sm" variant="outline" onClick={handleCollapseAll}>
            모두 접기
          </Button>
          <Button size="sm" variant="outline" onClick={handleReset}>
            초기화
          </Button>
        </div>
        <p className="text-sm text-text-secondary">
          <strong>자동 스크롤 테스트:</strong> 아이템을 드래그해서 컨테이너 상/하단 가장자리로 이동해 보세요.
          <br />
          현재는 자동 스크롤이 구현되어 있지 않아 스크롤 영역 밖으로 드래그할 수 없습니다.
        </p>
        <div className="text-xs text-text-tertiary">
          총 {items.length}개 부서, 각 5팀, 각 4명 = 약 200개 아이템
        </div>
        <div className={treeMenuWrapperClass}>
          <TreeMenu
            items={items}
            expandedIds={expandedIds}
            onExpandChange={setExpandedIds}
            draggable={true}
            onItemMove={handleItemMove}
          />
        </div>
      </div>
    );
  },
  argTypes: {
    size: { table: { disable: true } },
  },
};
