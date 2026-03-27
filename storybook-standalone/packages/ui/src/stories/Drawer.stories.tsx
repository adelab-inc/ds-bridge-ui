import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Drawer, DrawerProps } from '../components/Drawer';
import { Button } from '../components/Button';

// Storybook 컨트롤용 확장 Props (Compound 컴포넌트의 props를 포함)
interface StoryArgs extends DrawerProps {
  title?: string;
  showSubtitle?: boolean;
  subtitle?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}

/** Default 스토리와 동일한 기본 args (모든 스토리에서 재사용) */
const defaultArgs: Partial<StoryArgs> = {
  size: 'md',
  mode: 'base',
  dim: true,
  title: 'Drawer Title',
  showSubtitle: false,
  subtitle: '부제목이 필요한 경우 여기에 적습니다.',
  primaryLabel: '엑셀다운로드',
  secondaryLabel: '닫기',
};

const meta: Meta<StoryArgs> = {
  title: 'UI/Drawer',
  component: Drawer,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          '사이드 드로워 (Compound 패턴, 우측 슬라이드)',
          '',
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '### Drawer Root',
          '| Figma 속성 | Code prop | 비고 |',
          '|---|---|---|',
          '| Size | `size` | sm, md, lg, xl |',
          '| Mode | `mode` | base, compact |',
          '| Show Scrollbar | — | 브라우저 자동 처리 (overflow-y-auto) |',
          '',
          '### Drawer/Header',
          '| Figma 속성 | Code prop | 비고 |',
          '|---|---|---|',
          '| Title | `title` | 필수 |',
          '| Show Subtitle | `showSubtitle` | required boolean (기본 false) |',
          '| Subtitle | `subtitle` | showSubtitle={true}일 때 required string |',
          '',
          '### Drawer/Footer',
          '| Figma 속성 | Code prop | 비고 |',
          '|---|---|---|',
          '| Show Footer | `<Drawer.Footer>` 유무 | Compound children 패턴으로 제어. 미사용 시 Body가 남은 공간 확장 |',
          '| Show 2Action | `children` | React children 패턴 |',
          '| Show 3Action | `children` | React children 패턴 |',
          '| Show Control Group | `children` | React children 패턴 |',
          '',
          'Footer는 기본 `justify-end` 정렬. 좌우 분리 시 `className="justify-between"` 오버라이드.',
          '',
          '## V1 → V2 변경 사항',
          '| 항목 | V1 | V2 | 변경 |',
          '|---|---|---|---|',
          '| Header subtitle | 미지원 | showSubtitle + subtitle | 신규 추가 (discriminated union) |',
          '| CVA variants | size, mode | size, mode | 변경 없음 |',
          '| Footer 패턴 | children | children | 변경 없음 |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Figma: Size — 드로워 너비',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Figma: Mode — 간격 밀도',
    },
    dim: {
      control: 'boolean',
      description: '배경 딤 처리 여부',
    },
    title: {
      control: 'text',
      description: 'Figma: Title — Drawer.Header 제목',
    },
    showSubtitle: {
      control: 'boolean',
      description: 'Figma: Show Subtitle — 부제목 표시 여부',
    },
    subtitle: {
      control: 'text',
      description: 'Figma: Subtitle — Drawer.Header 부제목',
      if: { arg: 'showSubtitle', truthy: true },
    },
    primaryLabel: {
      control: 'text',
      description: 'Primary 버튼의 라벨',
    },
    secondaryLabel: {
      control: 'text',
      description: 'Secondary 버튼의 라벨',
    },
    onClose: { table: { disable: true } },
    open: { table: { disable: true } },
    children: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);

    const headerProps = args.showSubtitle
      ? { title: args.title || 'Drawer Title', showSubtitle: true as const, subtitle: args.subtitle || '부제목이 필요한 경우 여기에 적습니다.' }
      : { title: args.title || 'Drawer Title', showSubtitle: false as const };

    return (
      <div>
        <Button label="Open Drawer" onClick={() => setIsOpen(true)} showStartIcon={false} showEndIcon={false} />
        <Drawer
          size={args.size}
          mode={args.mode}
          dim={args.dim}
          open={isOpen}
          onClose={() => setIsOpen(false)}
        >
          <Drawer.Header {...headerProps} />
          <Drawer.Body>
            {args.children || 'Drawer content goes here. This is the body of the drawer.'}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              buttonType="tertiary"
              label={args.secondaryLabel || '닫기'}
              onClick={() => setIsOpen(false)}
              showStartIcon={false}
              showEndIcon={false}
            />
            <Button
              buttonType="primary"
              label={args.primaryLabel || '엑셀다운로드'}
              onClick={() => setIsOpen(false)}
              showStartIcon={false}
              showEndIcon={false}
            />
          </Drawer.Footer>
        </Drawer>
      </div>
    );
  },
  args: { ...defaultArgs },
};

/**
 * Footer 없이 드로워를 열면 Body가 남은 공간을 전부 채웁니다.
 * Figma: Show Footer = false → `<Drawer.Footer>` 미사용
 */
export const WithoutFooter: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);

    const headerProps = args.showSubtitle
      ? { title: args.title || 'Drawer Title', showSubtitle: true as const, subtitle: args.subtitle || '부제목이 필요한 경우 여기에 적습니다.' }
      : { title: args.title || 'Drawer Title', showSubtitle: false as const };

    return (
      <div>
        <Button label="Open Drawer (No Footer)" onClick={() => setIsOpen(true)} showStartIcon={false} showEndIcon={false} />
        <Drawer
          size={args.size}
          mode={args.mode}
          dim={args.dim}
          open={isOpen}
          onClose={() => setIsOpen(false)}
        >
          <Drawer.Header {...headerProps} />
          <Drawer.Body>
            {args.children || 'Footer 없이 Body가 남은 공간을 전부 채웁니다.'}
          </Drawer.Body>
        </Drawer>
      </div>
    );
  },
  args: { ...defaultArgs },
};

/**
 * Dim 없이 드로워를 열어 뒤쪽 화면을 자유롭게 조작할 수 있습니다.
 */
export const WithoutDim: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="p-8">
        <div className="flex flex-col gap-4">
          <Button label="Open Drawer (No Dim)" onClick={() => setIsOpen(true)} showStartIcon={false} showEndIcon={false} />
          <p className="text-text-primary">
            Dim이 없으므로 이 영역을 자유롭게 클릭할 수 있습니다.
          </p>
        </div>
        <Drawer
          size={args.size}
          mode={args.mode}
          dim={false}
          open={isOpen}
          onClose={() => setIsOpen(false)}
        >
          <Drawer.Header title="Dim 없는 드로워" showSubtitle={false} />
          <Drawer.Body>
            뒤쪽 화면을 자유롭게 조작할 수 있습니다.
          </Drawer.Body>
          <Drawer.Footer>
            <Button buttonType="primary" label="닫기" onClick={() => setIsOpen(false)} showStartIcon={false} showEndIcon={false} />
          </Drawer.Footer>
        </Drawer>
      </div>
    );
  },
  args: { ...defaultArgs, dim: false },
};

/**
 * 스크롤 가능한 긴 컨텐츠
 */
export const WithScrollableContent: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);

    const headerProps = args.showSubtitle
      ? { title: args.title || '스크롤 가능한 드로워', showSubtitle: true as const, subtitle: args.subtitle || '본문에 긴 컨텐츠가 있을 때 자동으로 스크롤이 생깁니다.' }
      : { title: args.title || '스크롤 가능한 드로워', showSubtitle: false as const };

    return (
      <div>
        <Button label="Open Scrollable Drawer" onClick={() => setIsOpen(true)} showStartIcon={false} showEndIcon={false} />
        <Drawer
          size={args.size}
          mode={args.mode}
          dim={args.dim}
          open={isOpen}
          onClose={() => setIsOpen(false)}
        >
          <Drawer.Header {...headerProps} />
          <Drawer.Body>
            <div className="flex flex-col gap-4 w-full">
              {Array.from({ length: 50 }, (_, i) => (
                <div key={i} className="p-4 border border-border-default rounded-lg">
                  <p className="text-text-primary">항목 {i + 1}</p>
                  <p className="text-text-secondary text-body-sm-regular">
                    스크롤을 테스트하기 위한 긴 컨텐츠입니다.
                  </p>
                </div>
              ))}
            </div>
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              buttonType="tertiary"
              label={args.secondaryLabel || '취소'}
              onClick={() => setIsOpen(false)}
              showStartIcon={false}
              showEndIcon={false}
            />
            <Button
              buttonType="primary"
              label={args.primaryLabel || '확인'}
              onClick={() => setIsOpen(false)}
              showStartIcon={false}
              showEndIcon={false}
            />
          </Drawer.Footer>
        </Drawer>
      </div>
    );
  },
  args: { ...defaultArgs, primaryLabel: '확인', secondaryLabel: '취소' },
};
