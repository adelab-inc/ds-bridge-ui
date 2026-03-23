import * as React from 'react';

// ─── 공통 Enum ───

export const Interaction = {
  DEFAULT: 'default',
  DISABLED: 'disabled',
  FOCUSED: 'focused',
  HOVER: 'hover',
  LOADING: 'loading',
  PRESSED: 'pressed',
} as const;
export type Interaction = (typeof Interaction)[keyof typeof Interaction];

export const Size = {
  LG: 'lg',
  MD: 'md',
  SM: 'sm',
} as const;
export type Size = (typeof Size)[keyof typeof Size];

export const Mode = {
  BASE: 'base',
  COMPACT: 'compact',
} as const;
export type Mode = (typeof Mode)[keyof typeof Mode];

// ─── Button ───

export const ButtonType = {
  DESTRUCTIVE: 'destructive',
  GHOST_INVERSE: 'ghost-inverse',
  OUTLINE: 'outline',
  OUTLINE_DESTRUCTIVE: 'outline-destructive',
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  TERTIARY: 'tertiary',
} as const;
export type ButtonType = (typeof ButtonType)[keyof typeof ButtonType];

// ─── IconButton ───

export const IconButtonType = {
  GHOST: 'ghost',
  GHOST_DESTRUCTIVE: 'ghost-destructive',
  SECONDARY: 'secondary',
  TERTIARY: 'tertiary',
} as const;
export type IconButtonType = (typeof IconButtonType)[keyof typeof IconButtonType];

// ─── Checkbox ───

export const CheckboxValue = {
  UNCHECKED: 'unchecked',
  CHECKED: 'checked',
  INDETERMINATE: 'indeterminate',
} as const;
export type CheckboxValue = (typeof CheckboxValue)[keyof typeof CheckboxValue];

// ─── Radio ───

export const RadioValue = {
  UNCHECKED: 'unchecked',
  CHECKED: 'checked',
} as const;
export type RadioValue = (typeof RadioValue)[keyof typeof RadioValue];

// ─── ToggleSwitch ───

export const ToggleSwitchSelected = {
  OFF: 'off',
  ON: 'on',
  DISABLED: 'disabled',
} as const;
export type ToggleSwitchSelected = (typeof ToggleSwitchSelected)[keyof typeof ToggleSwitchSelected];

// ─── Link ───

export const LinkUnderline = {
  ALWAYS: 'always',
  NONE: 'none',
  ON_HOVER: 'on-hover',
} as const;
export type LinkUnderline = (typeof LinkUnderline)[keyof typeof LinkUnderline];

export const LinkTone = {
  INHERIT: 'inherit',
  LINK: 'link',
} as const;
export type LinkTone = (typeof LinkTone)[keyof typeof LinkTone];

// ─── Select ───

export const SelectInteraction = {
  DEFAULT: 'default',
  DISABLED: 'disabled',
  ERROR: 'error',
  HOVER: 'hover',
  PRESSED: 'pressed',
  SELECTED: 'selected',
} as const;
export type SelectInteraction = (typeof SelectInteraction)[keyof typeof SelectInteraction];

// ─── Field ───

export const FieldInteraction = {
  DEFAULT: 'default',
  DISABLED: 'disabled',
  DISPLAY: 'display',
  EDITING: 'editing',
  READONLY: 'readonly',
  VALUE: 'value',
} as const;
export type FieldInteraction = (typeof FieldInteraction)[keyof typeof FieldInteraction];

// ─── Tag ───

export const TagType = {
  DEFAULT: 'default',
  MORE: 'more',
  SWATCH: 'swatch',
} as const;
export type TagType = (typeof TagType)[keyof typeof TagType];

export const TagColor = {
  RED: 'red',
  ORANGE: 'orange',
  YELLOW: 'yellow',
  LIME: 'lime',
  GREEN: 'green',
  CYAN: 'cyan',
  VIOLET: 'violet',
  PINK: 'pink',
} as const;
export type TagColor = (typeof TagColor)[keyof typeof TagColor];

// ─── LabelValue ───

export const LabelValueLabelWidth = {
  COMPACT: 'compact',
  DEFAULT: 'default',
  WIDE: 'wide',
} as const;
export type LabelValueLabelWidth = (typeof LabelValueLabelWidth)[keyof typeof LabelValueLabelWidth];

// ─── Menu Item Types ───

export type LeadingType = 'icon' | 'checkbox' | 'check' | 'avatar';
export type TrailingType = 'shortcut' | 'chevron' | 'external' | 'icon' | 'badge' | 'check';

interface MenuItemCommon {
  id: string;
  label?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  selected?: boolean;
}

interface MenuItemTextOnly extends MenuItemCommon {
  type: 'text-only';
}

interface MenuItemIconLabel extends MenuItemCommon {
  type: 'icon-label';
  leadingIcon?: React.ReactNode;
}

interface MenuItemShortcut extends MenuItemCommon {
  type: 'shortcut';
  shortcutText?: React.ReactNode;
}

interface MenuItemDestructive extends MenuItemCommon {
  type: 'destructive';
}

interface MenuItemSubmenu extends MenuItemCommon {
  type: 'submenu';
  children?: MenuItem[];
}

interface MenuItemLink extends MenuItemCommon {
  type: 'link';
}

interface MenuItemCheckbox extends MenuItemCommon {
  type: 'checkbox';
}

interface MenuItemToggle extends MenuItemCommon {
  type: 'toggle';
}

interface MenuItemSelection extends MenuItemCommon {
  type: 'selection';
}

interface MenuItemEmptyState extends MenuItemCommon {
  type: 'empty-state';
}

interface MenuItemBadge extends MenuItemCommon {
  type: 'badge';
  badgeContent?: React.ReactNode;
}

interface MenuItemProfile extends MenuItemCommon {
  type: 'profile';
  avatarContent?: React.ReactNode;
  description?: string;
}

interface MenuItemDescription extends MenuItemCommon {
  type: 'description';
  description?: string;
}

interface MenuItemIconLabelBadge extends MenuItemCommon {
  type: 'icon-label-badge';
  leadingIcon?: React.ReactNode;
  badgeContent?: React.ReactNode;
}

interface MenuItemCheckboxLabelBadge extends MenuItemCommon {
  type: 'checkbox-label-badge';
  badgeContent?: React.ReactNode;
}

interface MenuItemLabelIconBadge extends MenuItemCommon {
  type: 'label-icon-badge';
  closeTrailingIcon?: React.ReactNode;
  badgeContent?: React.ReactNode;
}

export type MenuItemBase =
  | MenuItemTextOnly
  | MenuItemIconLabel
  | MenuItemShortcut
  | MenuItemDestructive
  | MenuItemSubmenu
  | MenuItemLink
  | MenuItemCheckbox
  | MenuItemToggle
  | MenuItemSelection
  | MenuItemEmptyState
  | MenuItemBadge
  | MenuItemProfile
  | MenuItemDescription
  | MenuItemIconLabelBadge
  | MenuItemCheckboxLabelBadge
  | MenuItemLabelIconBadge;

export interface MenuItemDivider {
  type: 'divider';
}

export interface MenuItemHeading {
  type: 'heading';
  heading: string;
}

export type MenuItem = MenuItemBase | MenuItemDivider | MenuItemHeading;
