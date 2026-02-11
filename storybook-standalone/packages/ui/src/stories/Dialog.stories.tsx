import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';

import { Dialog, DialogProps } from '../components/Dialog';
import { ModalStackProvider } from '../components/ModalStackProvider';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { Option } from '../components/Option';
import { Icon } from '../components/Icon';

// Storybook 컨트롤용 확장 Props (Compound 컴포넌트의 props를 포함)
interface StoryArgs extends DialogProps {
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}

const meta: Meta<StoryArgs> = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Dialog의 크기를 선택합니다.',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    title: {
      control: 'text',
      description: 'Dialog.Header의 제목입니다.',
    },
    subtitle: {
      control: 'text',
      description: 'Dialog.Header의 부제목입니다 (선택사항).',
    },
    primaryLabel: {
      control: 'text',
      description: 'Primary 버튼의 라벨입니다.',
    },
    secondaryLabel: {
      control: 'text',
      description: 'Secondary 버튼의 라벨입니다.',
    },
    x: { table: { disable: true } },
    y: { table: { disable: true } },
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
    const [dontShowAgain, setDontShowAgain] = useState(false);

    return (
      <div>
        <Button onClick={() => setIsOpen(true)}>Open Dialog</Button>
        <Dialog
          size={args.size}
          mode={args.mode}
          open={isOpen}
          onClose={() => setIsOpen(false)}
          x={args.x}
          y={args.y}
        >
          <Dialog.Header
            title={args.title || 'Dialog Title'}
            subtitle={args.subtitle}
          />
          <Dialog.Body>
            {args.children || 'Dialog content goes here. This is the body of the dialog.'}
          </Dialog.Body>
          <Dialog.Footer>
            <Dialog.FooterLeft>
              <Option label="다시 보지 않기">
                <Checkbox
                  checked={dontShowAgain}
                  onChange={(e) => setDontShowAgain(e.target.checked)}
                />
              </Option>
            </Dialog.FooterLeft>
            <Dialog.FooterRight>
              <Button
                variant="outline"
                onClick={() => {
                  console.log('Secondary clicked');
                  setIsOpen(false);
                }}
              >
                {args.secondaryLabel || '취소'}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  console.log('Primary clicked, dontShowAgain:', dontShowAgain);
                  setIsOpen(false);
                }}
              >
                {args.primaryLabel || '확인'}
              </Button>
            </Dialog.FooterRight>
          </Dialog.Footer>
        </Dialog>
      </div>
    );
  },
  args: {
    size: 'md',
    mode: 'base',
    title: 'Dialog Title',
    subtitle: 'This is a subtitle description',
    children: 'Dialog content goes here. This is the body of the dialog.',
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
};

/**
 * 중첩 모달 테스트
 *
 * - ModalStackProvider로 감싸면 중첩 모달이 자동으로 관리됩니다.
 * - z-index가 자동으로 계산되어 새 모달이 항상 위에 표시됩니다.
 * - ESC 키와 Backdrop 클릭은 최상위 모달에만 반응합니다.
 * - Focus Trap도 최상위 모달에만 적용됩니다.
 */
export const NestedModals: Story = {
  render: (args) => {
    const [isFirstOpen, setIsFirstOpen] = useState(false);
    const [isSecondOpen, setIsSecondOpen] = useState(false);
    const [isThirdOpen, setIsThirdOpen] = useState(false);

    return (
      <ModalStackProvider>
        <div>
          <Button onClick={() => setIsFirstOpen(true)}>첫 번째 모달 열기</Button>

          {/* 첫 번째 모달 */}
          <Dialog
            open={isFirstOpen}
            onClose={() => setIsFirstOpen(false)}
            size={args.size}
            mode={args.mode}
          >
            <Dialog.Header
              title="첫 번째 모달"
              subtitle="중첩 모달을 테스트해보세요"
            />
            <Dialog.Body>
              <div className="flex flex-col gap-4">
                <p>이 모달 위에 다른 모달을 열 수 있습니다.</p>
                <p className="text-text-tertiary text-body-sm-regular">
                  ESC 키를 누르면 최상위 모달만 닫힙니다.
                </p>
                <Button onClick={() => setIsSecondOpen(true)}>
                  두 번째 모달 열기
                </Button>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.FooterRight>
                <Button variant="primary" onClick={() => setIsFirstOpen(false)}>
                  닫기
                </Button>
              </Dialog.FooterRight>
            </Dialog.Footer>
          </Dialog>

          {/* 두 번째 모달 */}
          <Dialog
            open={isSecondOpen}
            onClose={() => setIsSecondOpen(false)}
            size={args.size}
            mode={args.mode}
          >
            <Dialog.Header
              title="두 번째 모달"
              subtitle="z-index가 자동으로 높아졌습니다"
            />
            <Dialog.Body>
              <div className="flex flex-col gap-4">
                <p>첫 번째 모달 위에 표시됩니다.</p>
                <p className="text-text-tertiary text-body-sm-regular">
                  Backdrop을 클릭하면 이 모달만 닫힙니다.
                </p>
                <Button onClick={() => setIsThirdOpen(true)}>
                  세 번째 모달 열기
                </Button>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.FooterRight>
                <Button variant="outline" onClick={() => setIsSecondOpen(false)}>
                  취소
                </Button>
                <Button variant="primary" onClick={() => setIsSecondOpen(false)}>
                  닫기
                </Button>
              </Dialog.FooterRight>
            </Dialog.Footer>
          </Dialog>

          {/* 세 번째 모달 */}
          <Dialog
            open={isThirdOpen}
            onClose={() => setIsThirdOpen(false)}
            size={args.size}
            mode={args.mode}
          >
            <Dialog.Header
              title="세 번째 모달"
              subtitle="최상위 모달입니다"
            />
            <Dialog.Body>
              <div className="flex flex-col gap-4">
                <p>3단계 중첩 모달입니다.</p>
                <p className="text-text-tertiary text-body-sm-regular">
                  Tab 키로 포커스 순환을 테스트해보세요.
                  이 모달 내부에서만 순환됩니다.
                </p>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
              <Dialog.FooterRight>
                <Button variant="outline" onClick={() => setIsThirdOpen(false)}>
                  이것만 닫기
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    setIsThirdOpen(false);
                    setIsSecondOpen(false);
                    setIsFirstOpen(false);
                  }}
                >
                  모두 닫기
                </Button>
              </Dialog.FooterRight>
            </Dialog.Footer>
          </Dialog>
        </div>
      </ModalStackProvider>
    );
  },
  args: {
    size: 'md',
    mode: 'base',
  },
  parameters: {
    docs: {
      description: {
        story: '`ModalStackProvider`로 감싸면 중첩 모달이 자동으로 관리됩니다. z-index, ESC 키, Focus Trap이 최상위 모달에만 적용됩니다.',
      },
    },
  },
};
