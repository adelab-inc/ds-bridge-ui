import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Menu, type MenuItem } from '../components/Menu';
import { Icon } from '../components/Icon';
import { Badge } from '../components/Badge';

/**
 * md / sm 두 사이즈를 나란히 보여주는 레이아웃 헬퍼
 */
const applyDisabled = (items: MenuItem[], disabled?: boolean): MenuItem[] =>
  disabled ? items.map((item) => ('id' in item ? { ...item, disabled: true } : item)) : items;

const PresetRow = ({
  label,
  mdItems,
  smItems,
  mdOnly = false,
  disabled = false,
}: {
  label: string;
  mdItems: MenuItem[];
  smItems?: MenuItem[];
  mdOnly?: boolean;
  disabled?: boolean;
}) => (
  <div className="flex items-start gap-8 py-4 border-b border-border-default">
    <div className="w-[80px] flex-shrink-0 pt-2 text-caption-xs-bold text-text-accent">
      {label}
    </div>
    <div className="flex-1">
      <Menu items={applyDisabled(mdItems, disabled)} size="md" className="w-[240px]" />
    </div>
    <div className="flex-1">
      {mdOnly ? (
        <div className="flex items-center justify-center h-[40px] text-text-tertiary text-caption-xs-regular">
          md only
        </div>
      ) : (
        <Menu items={applyDisabled(smItems ?? mdItems, disabled)} size="sm" className="w-[240px]" />
      )}
    </div>
  </div>
);

/**
 * 선택 상태를 토글할 수 있는 인터랙티브 PresetRow (md/sm 독립 상태)
 */
const ToggleablePresetRow = ({
  label,
  mdItems: initialMdItems,
  smItems: initialSmItems,
  mdOnly = false,
  disabled = false,
}: {
  label: string;
  mdItems: MenuItem[];
  smItems?: MenuItem[];
  mdOnly?: boolean;
  disabled?: boolean;
}) => {
  const getInitialIds = (items: MenuItem[]) => {
    const ids = new Set<string>();
    for (const item of items) {
      if ('selected' in item && item.selected && 'id' in item) ids.add(item.id);
    }
    return ids;
  };

  const [mdSelectedIds, setMdSelectedIds] = React.useState<Set<string>>(() => getInitialIds(initialMdItems));
  const [smSelectedIds, setSmSelectedIds] = React.useState<Set<string>>(() => getInitialIds(initialSmItems ?? initialMdItems));

  const createToggle = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (item: MenuItem) => {
    if (!('id' in item) || !item.id) return;
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(item.id!)) next.delete(item.id!);
      else next.add(item.id!);
      return next;
    });
  };

  const applyState = (items: MenuItem[], selectedIds: Set<string>): MenuItem[] =>
    items.map((item) => ('id' in item ? { ...item, selected: selectedIds.has(item.id!), ...(disabled && { disabled: true }) } : item));

  return (
    <div className="flex items-start gap-8 py-4 border-b border-border-default">
      <div className="w-[80px] flex-shrink-0 pt-2 text-caption-xs-bold text-text-accent">
        {label}
      </div>
      <div className="flex-1">
        <Menu items={applyState(initialMdItems, mdSelectedIds)} size="md" className="w-[240px]" onItemClick={createToggle(setMdSelectedIds)} />
      </div>
      <div className="flex-1">
        {mdOnly ? (
          <div className="flex items-center justify-center h-[40px] text-text-tertiary text-caption-xs-regular">
            md only
          </div>
        ) : (
          <Menu items={applyState(initialSmItems ?? initialMdItems, smSelectedIds)} size="sm" className="w-[240px]" onItemClick={createToggle(setSmSelectedIds)} />
        )}
      </div>
    </div>
  );
};

interface PresetStoryArgs {
  disabled?: boolean;
}

const meta: Meta<PresetStoryArgs> = {
  title: 'UI/Menu/MenuItem/Preset',
  component: Menu,
  argTypes: {
    disabled: {
      control: 'boolean',
      description: '모든 아이템 비활성화',
      table: { defaultValue: { summary: 'false' } },
    },
  },
  args: {
    disabled: false,
  },
  parameters: {
    docs: {
      source: { type: 'code' },
      description: {
        component: [
          '## MenuItem Type별 프리셋',
          '',
          'Figma의 Menu/MenuItem/Type과 1:1 매핑되는 16개 아이템 타입입니다.',
          '',
          '- **sm/md 모두 지원**: text-only, icon-label, shortcut, destructive, submenu, link, checkbox, toggle, selection, empty-state',
          '- **md only**: badge, profile, description, icon-label-badge, checkbox-label-badge, label-icon-badge',
        ].join('\n'),
      },
    },
    a11y: { disable: true },
  },
};

export default meta;
type Story = StoryObj<PresetStoryArgs>;

/* ─── sm/md 모두 지원하는 타입들 ─── */

export const TextOnly: Story = {
  name: 'Text Only',
  render: (args) => (
    <PresetRow
      label="Text Only"
      disabled={args.disabled}
      mdItems={[{ type: 'text-only', id: '1', label: '메뉴 이름' }]}
    />
  ),
};

export const IconLabel: Story = {
  name: 'Icon Label',
  render: (args) => (
    <PresetRow
      label="Icon Label"
      disabled={args.disabled}
      mdItems={[{ type: 'icon-label', id: '1', label: '아이콘과 메뉴', leadingIcon: <Icon name="widgets" size={20} /> }]}
      smItems={[{ type: 'icon-label', id: '1', label: '아이콘과 메뉴', leadingIcon: <Icon name="widgets" size={20} /> }]}
    />
  ),
};

export const Shortcut: Story = {
  name: 'Shortcut',
  render: (args) => (
    <PresetRow
      label="Shortcut"
      disabled={args.disabled}
      mdItems={[{ type: 'shortcut', id: '1', label: '복사하기', shortcutText: 'Ctrl+C' }]}
    />
  ),
};

export const Destructive: Story = {
  name: 'Destructive',
  render: (args) => (
    <PresetRow
      label="Destructive"
      disabled={args.disabled}
      mdItems={[{ type: 'destructive', id: '1', label: '탈퇴하기' }]}
      smItems={[{ type: 'destructive', id: '1', label: '삭제하기' }]}
    />
  ),
};

export const Submenu: Story = {
  name: 'Submenu',
  render: (args) => {
    const parentItems = applyDisabled([{ type: 'submenu' as const, id: '1', label: '서브메뉴 연결되는 메뉴', children: [] }], args.disabled);
    const childItems = applyDisabled([{ type: 'text-only' as const, id: '1-1', label: '하위 항목 1' }, { type: 'text-only' as const, id: '1-2', label: '하위 항목 2' }], args.disabled);
    return (
      <div className="flex flex-col gap-4 py-4 border-b border-border-default">
        <div className="flex items-start gap-8">
          <div className="w-[80px] flex-shrink-0 pt-2 text-caption-xs-bold text-text-accent">
            Submenu
          </div>
          <div className="relative pb-4">
            <div className="text-caption-xs-regular text-text-tertiary mb-2">md</div>
            <div className="relative">
              <Menu items={parentItems} size="md" className="w-[240px]" />
              <div className="absolute left-[244px] -top-[4px]">
                <Menu items={childItems} size="md" className="w-[240px]" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-start gap-8">
          <div className="w-[80px] flex-shrink-0" />
          <div className="relative">
            <div className="text-caption-xs-regular text-text-tertiary mb-2">sm</div>
            <div className="relative">
              <Menu items={parentItems} size="sm" className="w-[240px]" />
              <div className="absolute left-[244px] -top-[4px]">
                <Menu items={childItems} size="sm" className="w-[240px]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  },
};

export const Link: Story = {
  name: 'Link',
  render: (args) => (
    <PresetRow
      label="Link"
      disabled={args.disabled}
      mdItems={[{ type: 'link', id: '1', label: '외부 링크 메뉴' }]}
    />
  ),
};

export const CheckboxType: Story = {
  name: 'Checkbox',
  render: (args) => (
    <ToggleablePresetRow
      label="Checkbox"
      disabled={args.disabled}
      mdItems={[{ type: 'checkbox', id: '1', label: '다중 선택 드롭다운' }]}
    />
  ),
};

export const Toggle: Story = {
  name: 'Toggle',
  render: (args) => (
    <ToggleablePresetRow
      label="Toggle"
      disabled={args.disabled}
      mdItems={[{ type: 'toggle', id: '1', label: '컨텍스트 메뉴용', selected: true }]}
    />
  ),
};

export const Selection: Story = {
  name: 'Selection',
  render: (args) => (
    <ToggleablePresetRow
      label="Selection"
      disabled={args.disabled}
      mdItems={[{ type: 'selection', id: '1', label: '단일 선택 드롭다운', selected: true }]}
    />
  ),
};

export const EmptyState: Story = {
  name: 'Empty State',
  render: () => (
    <div className="flex items-start gap-8 py-4 border-b border-border-default">
      <div className="w-[80px] flex-shrink-0 pt-2 text-caption-xs-bold text-text-accent">
        Empty State
      </div>
      <div className="flex-1">
        <Menu items={[]} size="md" emptyText="값이 없습니다." className="w-[240px]" />
      </div>
      <div className="flex-1">
        <Menu items={[]} size="sm" emptyText="값이 없습니다." className="w-[240px]" />
      </div>
    </div>
  ),
};

export const DotBadge: Story = {
  name: 'Dot Badge (공통 prop)',
  render: (args) => (
    <PresetRow
      label="Dot Badge"
      disabled={args.disabled}
      mdItems={[
        { type: 'text-only', id: '1', label: '메시지', dotBadge: true },
        { type: 'icon-label', id: '2', label: '알림', leadingIcon: <Icon name="widgets" size={20} />, dotBadge: true },
      ]}
      smItems={[
        { type: 'text-only', id: '1', label: '메시지', dotBadge: true },
        { type: 'icon-label', id: '2', label: '알림', leadingIcon: <Icon name="widgets" size={20} />, dotBadge: true },
      ]}
    />
  ),
};

/* ─── md only 타입들 ─── */

export const BadgeType: Story = {
  name: 'Badge',
  render: (args) => (
    <PresetRow
      label="Badge"
      disabled={args.disabled}
      mdItems={[{
        type: 'badge',
        id: '1',
        label: '결제함',
        badgeContent: <Badge type="status" status="info" label="N" />,
      }]}
      mdOnly
    />
  ),
};

export const Profile: Story = {
  name: 'Profile',
  render: (args) => (
    <PresetRow
      label="Profile"
      disabled={args.disabled}
      mdItems={[{
        type: 'profile',
        id: '1',
        label: '내 프로필',
        avatarContent: <Icon name="person" size={24} />,
        description: 'email@mail.com',
      }]}
      mdOnly
    />
  ),
};

export const Description: Story = {
  name: 'Description',
  render: (args) => (
    <PresetRow
      label="Description"
      disabled={args.disabled}
      mdItems={[{
        type: 'description',
        id: '1',
        label: '부가설명이 있는 메뉴',
        description: '이것은 Description입니다. 최대 2줄까지 가능합니다.',
      }]}
      mdOnly
    />
  ),
};

/* ─── Badge 조합 타입들 (md only) ─── */

export const IconLabelBadge: Story = {
  name: 'Icon Label Badge',
  render: (args) => (
    <PresetRow
      label="Icon Label Badge"
      disabled={args.disabled}
      mdItems={[{
        type: 'icon-label-badge',
        id: '1',
        label: '아이콘과 뱃지',
        leadingIcon: <Icon name="widgets" size={20} />,
        badgeContent: <Badge type="status" status="info" label="N" />,
      }]}
      mdOnly
    />
  ),
};

export const CheckboxLabelBadge: Story = {
  name: 'Checkbox Label Badge',
  render: (args) => (
    <ToggleablePresetRow
      label="Checkbox Label Badge"
      disabled={args.disabled}
      mdItems={[{
        type: 'checkbox-label-badge',
        id: '1',
        label: '체크박스와 뱃지',
        badgeContent: <Badge type="status" status="success" label="3" />,
      }]}
      mdOnly
    />
  ),
};

export const LabelIconBadge: Story = {
  name: 'Label Icon Badge',
  render: (args) => (
    <PresetRow
      label="Label Icon Badge"
      disabled={args.disabled}
      mdItems={[{
        type: 'label-icon-badge',
        id: '1',
        label: '아이콘 뱃지',
        closeTrailingIcon: <Icon name="success" size={20} />,
        badgeContent: <Badge type="status" status="warning" label="2" />,
      }]}
      mdOnly
    />
  ),
};

/* ─── 전체 프리셋 한눈에 보기 ─── */

export const AllPresets: Story = {
  name: 'All Presets',
  render: (args) => (
    <div className="p-4">
      {/* 헤더 */}
      <div className="flex items-center gap-8 pb-4 border-b-2 border-border-default">
        <div className="w-[80px] flex-shrink-0" />
        <div className="flex-1 text-label-md-bold text-text-accent">md</div>
        <div className="flex-1 text-label-md-bold text-text-accent">sm</div>
      </div>

      {/* sm/md 모두 지원 */}
      <PresetRow
        label="Text Only"
        disabled={args.disabled}
        mdItems={[{ type: 'text-only', id: 'to', label: '메뉴 이름' }]}
      />
      <PresetRow
        label="Icon Label"
        disabled={args.disabled}
        mdItems={[{ type: 'icon-label', id: 'il', label: '아이콘과 메뉴', leadingIcon: <Icon name="widgets" size={20} /> }]}
        smItems={[{ type: 'icon-label', id: 'il', label: '아이콘과 메뉴', leadingIcon: <Icon name="widgets" size={20} /> }]}
      />
      <PresetRow
        label="Shortcut"
        disabled={args.disabled}
        mdItems={[{ type: 'shortcut', id: 'sc', label: '복사하기', shortcutText: 'Ctrl+C' }]}
      />
      <PresetRow
        label="Badge"
        disabled={args.disabled}
        mdItems={[{ type: 'badge', id: 'bd', label: '결제함', badgeContent: <Badge type="status" status="info" label="N" /> }]}
        mdOnly
      />
      <PresetRow
        label="Destructive"
        disabled={args.disabled}
        mdItems={[{ type: 'destructive', id: 'ds', label: '탈퇴하기' }]}
        smItems={[{ type: 'destructive', id: 'ds', label: '삭제하기' }]}
      />
      <PresetRow
        label="Submenu"
        disabled={args.disabled}
        mdItems={[{
          type: 'submenu', id: 'sm', label: '서브메뉴 연결되는 메뉴',
          children: [{ type: 'text-only', id: 'sm-1', label: '하위 항목' }],
        }]}
      />
      <PresetRow
        label="Link"
        disabled={args.disabled}
        mdItems={[{ type: 'link', id: 'lk', label: '외부 링크 메뉴' }]}
      />
      <ToggleablePresetRow
        label="Checkbox"
        disabled={args.disabled}
        mdItems={[{ type: 'checkbox', id: 'cb', label: '다중 선택 드롭다운' }]}
      />
      <ToggleablePresetRow
        label="Toggle"
        disabled={args.disabled}
        mdItems={[{ type: 'toggle', id: 'tg', label: '컨텍스트 메뉴용', selected: true }]}
      />
      <ToggleablePresetRow
        label="Selection"
        disabled={args.disabled}
        mdItems={[{ type: 'selection', id: 'sl', label: '단일 선택 드롭다운', selected: true }]}
      />

      {/* Dot Badge (공통 prop) */}
      <PresetRow
        label="Dot Badge"
        disabled={args.disabled}
        mdItems={[{ type: 'text-only', id: 'db', label: '메시지', dotBadge: true }]}
      />

      {/* Empty State */}
      <div className="flex items-start gap-8 py-4 border-b border-border-default">
        <div className="w-[80px] flex-shrink-0 pt-2 text-caption-xs-bold text-text-accent">Empty State</div>
        <div className="flex-1">
          <Menu items={[]} size="md" emptyText="값이 없습니다." className="w-[240px]" />
        </div>
        <div className="flex-1">
          <Menu items={[]} size="sm" emptyText="값이 없습니다." className="w-[240px]" />
        </div>
      </div>

      {/* md only */}
      <PresetRow
        label="Profile"
        disabled={args.disabled}
        mdItems={[{
          type: 'profile', id: 'pf', label: '내 프로필',
          avatarContent: <Icon name="person" size={24} />,
          description: 'email@mail.com',
        }]}
        mdOnly
      />
      <PresetRow
        label="Description"
        disabled={args.disabled}
        mdItems={[{
          type: 'description', id: 'dc', label: '부가설명이 있는 메뉴',
          description: '이것은 Description입니다. 최대 2줄까지 가능합니다.',
        }]}
        mdOnly
      />
    </div>
  ),
};
