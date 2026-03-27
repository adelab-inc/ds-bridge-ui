import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { Alert } from '../components/Alert';
import { ToastProvider, useToast } from '../components/Toast';
import type { ToastPosition } from '../components/Toast/types';

const meta: Meta<typeof Alert> = {
  title: 'UI/Alert/Toast',
  component: Alert,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Toast notification system with animations, positioning, and auto-dismiss.',
      },
    },
  },
  argTypes: {
    type: {
      control: 'select',
      options: ['default', 'info', 'success', 'warning', 'error'],
      description: 'Figma: `Type` / `State`. 알림 유형',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Spacing density mode',
    },
    isToast: {
      control: 'boolean',
      description: 'Figma: AlertToast. 고정 너비 480px + 그림자 + 2줄 제한',
    },
    body: {
      control: 'text',
      description: 'Figma: `body`. 알림 본문',
    },
    showIcon: {
      control: 'boolean',
      description: 'Figma: `showIcon`. 아이콘 표시 여부',
    },
    showTitle: {
      control: 'boolean',
      description: 'Figma: `showTitle`. true이면 stacked 레이아웃 자동 적용',
    },
    title: {
      control: 'text',
      description: 'showTitle=true일 때 제목 텍스트',
      if: { arg: 'showTitle', truthy: true },
    },
    showClose: {
      control: 'boolean',
      description: 'Figma: `showClose`. 닫기 버튼 표시',
    },
    showActionGroup: {
      control: 'boolean',
      description: 'Figma: `showActionGroup`. 액션 버튼 영역 활성화',
    },
    showAction1: {
      control: 'boolean',
      description: 'Figma: `showAction1`. 첫 번째 액션 버튼',
      if: { arg: 'showActionGroup', truthy: true },
    },
    action1Label: {
      control: 'text',
      description: 'showAction1=true일 때 버튼 라벨',
      if: { arg: 'showAction1', truthy: true },
    },
    showAction2: {
      control: 'boolean',
      description: 'Figma: `showAction2`. 두 번째 액션 버튼',
      if: { arg: 'showActionGroup', truthy: true },
    },
    action2Label: {
      control: 'text',
      description: 'showAction2=true일 때 버튼 라벨',
      if: { arg: 'showAction2', truthy: true },
    },
    onClose: { table: { disable: true } },
    action1OnClick: { table: { disable: true } },
    action2OnClick: { table: { disable: true } },
    icon: { table: { disable: true } },
  } as Record<string, unknown>,
  decorators: [
    (Story) => (
      <ToastProvider>
        <div className="w-[480px]">
          <Story />
        </div>
      </ToastProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<Record<string, unknown>>;

export const Default: Story = {
  args: {
    isToast: true,
    type: 'info',
    mode: 'base',
    showIcon: true,
    showTitle: false,
    title: '알림 제목',
    body: '이것은 매우 긴 메시지입니다. Toast에서는 2줄까지만 표시되고 나머지는 잘립니다. 이 텍스트는 2줄을 초과하는 긴 내용을 테스트하기 위한 것입니다. 충분히 길어야 2줄 제한이 적용되는 것을 확인할 수 있습니다.',
    showClose: true,
    onClose: () => console.log('close'),
    showActionGroup: false,
    showAction1: true,
    action1Label: '확인',
    action1OnClick: () => console.log('Action 1'),
    showAction2: false,
    action2Label: '취소',
    action2OnClick: () => console.log('Action 2'),
  } as Record<string, unknown> as Story['args'],
};

// Demo component for interactive testing
const ToastDemo: React.FC = () => {
  const toast = useToast();

  return (
    <div className="flex flex-col gap-4 p-8">
      <h2 className="text-heading-md-semibold mb-4">Toast Notifications</h2>

      {/* Variant Tests */}
      <div className="flex flex-col gap-2">
        <h3 className="text-body-md-medium">Variants</h3>
        <div className="flex gap-2">
          <button
            onClick={() => toast.success('작업이 성공적으로 완료되었습니다.')}
            className="px-4 py-2 bg-semantic-success text-white rounded animate-spin"
          >
            Success
          </button>
          <button
            onClick={() => toast.error('오류가 발생했습니다.')}
            className="px-4 py-2 bg-semantic-error text-white rounded"
          >
            Error
          </button>
          <button
            onClick={() => toast.warning('주의가 필요합니다.')}
            className="px-4 py-2 bg-semantic-warning text-white rounded"
          >
            Warning
          </button>
          <button
            onClick={() => toast.info('새로운 정보가 있습니다.')}
            className="px-4 py-2 bg-semantic-info text-white rounded"
          >
            Info
          </button>
          <button
            onClick={() => toast.default('일반 알림입니다.')}
            className="px-4 py-2 bg-neutral-gray-600 text-white rounded"
          >
            Default
          </button>
        </div>
      </div>

      {/* Position Tests */}
      <div className="flex flex-col gap-2">
        <h3 className="text-body-md-medium">Positions</h3>
        <div className="grid grid-cols-3 gap-2">
          {(['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'] as ToastPosition[]).map(
            (position) => (
              <button
                key={position}
                onClick={() =>
                  toast.info(`Position: ${position}`, { position })
                }
                className="px-4 py-2 bg-brand-blue-600 text-white rounded text-sm"
              >
                {position}
              </button>
            )
          )}
        </div>
      </div>

      {/* With Title & Actions */}
      <div className="flex flex-col gap-2">
        <h3 className="text-body-md-medium">Advanced</h3>
        <div className="flex gap-2">
          <button
            onClick={() =>
              toast.success('파일이 업로드되었습니다.', {
                title: '업로드 완료',
                action1: { label: '보기', onClick: () => console.log('View clicked') },
                action2: { label: '공유', onClick: () => console.log('Share clicked') },
              })
            }
            className="px-4 py-2 bg-semantic-success text-white rounded"
          >
            With Title & Actions
          </button>

          <button
            onClick={() =>
              toast.info(
                '이것은 매우 긴 메시지입니다. Toast에서는 2줄까지만 표시되고 나머지는 잘립니다. 이 텍스트는 2줄을 초과하는 긴 내용을 테스트하기 위한 것입니다.',
                { title: '긴 메시지 테스트' }
              )
            }
            className="px-4 py-2 bg-semantic-info text-white rounded"
          >
            Long Message (2-line clamp)
          </button>

          <button
            onClick={() => {
              const id = toast.info('이 Toast는 자동으로 닫히지 않습니다.', {
                duration: 0,
                title: '영구 Toast',
              });
              console.log('Toast ID:', id);
            }}
            className="px-4 py-2 bg-neutral-gray-600 text-white rounded"
          >
            No Auto-Dismiss
          </button>
        </div>
      </div>

      {/* Multiple Toasts */}
      <div className="flex flex-col gap-2">
        <h3 className="text-body-md-medium">Multiple Toasts</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              for (let i = 1; i <= 3; i++) {
                setTimeout(() => {
                  toast.info(`Toast #${i}`, { position: 'top-right' });
                }, i * 500);
              }
            }}
            className="px-4 py-2 bg-brand-blue-600 text-white rounded"
          >
            Show 3 Toasts (Stacked)
          </button>

          <button
            onClick={() => {
              toast.success('Top Left', { position: 'top-left' });
              toast.info('Top Right', { position: 'top-right' });
              toast.warning('Bottom Left', { position: 'bottom-left' });
              toast.error('Bottom Right', { position: 'bottom-right' });
            }}
            className="px-4 py-2 bg-brand-blue-600 text-white rounded"
          >
            Show 4 Corners
          </button>

          <button
            onClick={() => toast.dismissAll()}
            className="px-4 py-2 bg-neutral-gray-800 text-white rounded"
          >
            Dismiss All
          </button>
        </div>
      </div>

      {/* Duration Tests */}
      <div className="flex flex-col gap-2">
        <h3 className="text-body-md-medium">Duration</h3>
        <div className="flex gap-2">
          <button
            onClick={() => toast.info('1초 후 닫힘', { duration: 1000 })}
            className="px-4 py-2 bg-brand-blue-600 text-white rounded"
          >
            1s duration
          </button>
          <button
            onClick={() => toast.info('5초 후 닫힘', { duration: 5000 })}
            className="px-4 py-2 bg-brand-blue-600 text-white rounded"
          >
            5s duration
          </button>
          <button
            onClick={() => toast.info('10초 후 닫힘', { duration: 10000 })}
            className="px-4 py-2 bg-brand-blue-600 text-white rounded"
          >
            10s duration
          </button>
        </div>
      </div>
    </div>
  );
};

export const Interactive: Story = {
  render: () => <ToastDemo />,
};
