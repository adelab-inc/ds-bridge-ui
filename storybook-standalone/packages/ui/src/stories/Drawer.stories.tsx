import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { Drawer, DrawerProps } from '../components/Drawer';
import { ModalStackProvider } from '../components/ModalStackProvider';
import { Button } from '../components/Button';

// Storybook 컨트롤용 확장 Props (Compound 컴포넌트의 props를 포함)
interface StoryArgs extends DrawerProps {
  title?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}

const meta: Meta<StoryArgs> = {
  title: 'UI/Drawer',
  component: Drawer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Drawer의 크기(너비)를 선택합니다.',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    dim: {
      control: 'boolean',
      description: 'Dim(배경 어둡게) 처리 여부',
    },
    title: {
      control: 'text',
      description: 'Drawer.Header의 제목입니다.',
    },
    primaryLabel: {
      control: 'text',
      description: 'Primary 버튼의 라벨입니다.',
    },
    secondaryLabel: {
      control: 'text',
      description: 'Secondary 버튼의 라벨입니다.',
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

    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Drawer</Button>
        <Drawer
          size={args.size}
          mode={args.mode}
          dim={args.dim}
          open={isOpen}
          onClose={() => setIsOpen(false)}
        >
          <Drawer.Header title={args.title || 'Drawer Title'} />
          <Drawer.Body>
            {args.children || 'Drawer content goes here. This is the body of the drawer.'}
          </Drawer.Body>
          <Drawer.Footer>
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
            >
              {args.secondaryLabel || '취소'}
            </Button>
            <Button
              variant="primary"
              onClick={() => setIsOpen(false)}
            >
              {args.primaryLabel || '확인'}
            </Button>
          </Drawer.Footer>
        </Drawer>
      </div>
    );
  },
  args: {
    size: 'md',
    mode: 'base',
    dim: true,
    title: 'Drawer Title',
    children: 'Drawer content goes here. This is the body of the drawer.',
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
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
          <Button onClick={() => setIsOpen(true)}>Open Drawer (No Dim)</Button>
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
          <Drawer.Header title="Dim 없는 드로워" />
          <Drawer.Body>
            뒤쪽 화면을 자유롭게 조작할 수 있습니다.
          </Drawer.Body>
          <Drawer.Footer>
            <Button variant="primary" onClick={() => setIsOpen(false)}>
              닫기
            </Button>
          </Drawer.Footer>
        </Drawer>
      </div>
    );
  },
  args: {
    size: 'md',
    mode: 'base',
  },
};

/**
 * 모든 사이즈 비교
 */
export const AllSizes: Story = {
  render: () => {
    const [openSize, setOpenSize] = useState<'sm' | 'md' | 'lg' | 'xl' | null>(null);

    return (
      <div className="p-8 flex gap-4">
        {(['sm', 'md', 'lg', 'xl'] as const).map((size) => (
          <Button key={size} onClick={() => setOpenSize(size)}>
            {size.toUpperCase()} (
            {size === 'sm' ? '352px' : size === 'md' ? '552px' : size === 'lg' ? '752px' : '1152px'}
            )
          </Button>
        ))}
        {openSize && (
          <Drawer
            size={openSize}
            open={true}
            onClose={() => setOpenSize(null)}
          >
            <Drawer.Header title={`Size: ${openSize.toUpperCase()}`} />
            <Drawer.Body>
              {`이 드로워의 너비는 ${openSize === 'sm' ? '352px' : openSize === 'md' ? '552px' : openSize === 'lg' ? '752px' : '1152px'} 입니다.`}
            </Drawer.Body>
            <Drawer.Footer>
              <Button variant="primary" onClick={() => setOpenSize(null)}>
                닫기
              </Button>
            </Drawer.Footer>
          </Drawer>
        )}
      </div>
    );
  },
};

/**
 * 스크롤 가능한 긴 컨텐츠
 */
export const WithScrollableContent: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Scrollable Drawer</Button>
        <Drawer
          size={args.size}
          mode={args.mode}
          open={isOpen}
          onClose={() => setIsOpen(false)}
        >
          <Drawer.Header title="스크롤 가능한 드로워" />
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
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              취소
            </Button>
            <Button variant="primary" onClick={() => setIsOpen(false)}>
              확인
            </Button>
          </Drawer.Footer>
        </Drawer>
      </div>
    );
  },
  args: {
    size: 'md',
    mode: 'base',
  },
};
