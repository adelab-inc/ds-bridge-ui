import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';
import { ToastProvider, useToast } from '../components/Toast';
import type { ToastPosition } from '../components/Toast/types';

const meta = {
  title: 'UI/Alert/Toast',
  component: ToastProvider,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'Toast notification system with animations, positioning, and auto-dismiss.',
      },
    },
  },
  decorators: [
    (Story) => (
      <ToastProvider>
        <Story />
      </ToastProvider>
    ),
  ],
} satisfies Meta<typeof ToastProvider>;

export default meta;
type Story = StoryObj<typeof meta>;

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
                actions: [
                  { label: '보기', onClick: () => console.log('View clicked') },
                  { label: '공유', onClick: () => console.log('Share clicked') },
                ],
              })
            }
            className="px-4 py-2 bg-semantic-success text-white rounded"
          >
            With Title & Actions
          </button>

          <button
            onClick={() =>
              toast.info(
                '이것은 매우 긴 메시지입니다. Toast에서는 2줄까지만 표시되고 나머지는 말줄임표로 처리됩니다. hover하면 전체 내용을 Tooltip으로 볼 수 있습니다.',
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

// Basic Examples
export const Success: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.success('작업이 성공적으로 완료되었습니다.');
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};

export const Error: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.error('오류가 발생했습니다. 다시 시도해주세요.');
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};

export const Warning: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.warning('이 작업은 취소할 수 없습니다.');
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};

export const Info: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.info('새로운 업데이트가 있습니다.');
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};

export const WithTitle: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.success('파일이 성공적으로 업로드되었습니다.', {
        title: '업로드 완료',
      });
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};

export const WithActions: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.info('새로운 메시지가 도착했습니다.', {
        title: '알림',
        actions: [
          { label: '확인', onClick: () => console.log('확인 clicked') },
          { label: '무시', onClick: () => console.log('무시 clicked') },
        ],
      });
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};

export const LongMessage: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.info(
        '이것은 매우 긴 메시지입니다. Toast는 기본적으로 2줄까지만 표시되며, 그 이상의 내용은 말줄임표(...)로 처리됩니다. 마우스를 올리면 Tooltip을 통해 전체 내용을 확인할 수 있습니다.',
        { title: '긴 메시지 예시' }
      );
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};

export const NoAutoClose: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.warning('수동으로 닫아야 하는 중요한 알림입니다.', {
        title: '중요',
        duration: 0,
      });
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};

export const MultipleToasts: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.success('첫 번째 알림', { position: 'top-right' });
      setTimeout(() => toast.info('두 번째 알림', { position: 'top-right' }), 500);
      setTimeout(() => toast.warning('세 번째 알림', { position: 'top-right' }), 1000);
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};

export const DifferentPositions: Story = {
  render: () => {
    const toast = useToast();
    React.useEffect(() => {
      toast.success('Top Left', { position: 'top-left' });
      toast.info('Top Center', { position: 'top-center' });
      toast.warning('Top Right', { position: 'top-right' });
      setTimeout(() => {
        toast.error('Bottom Left', { position: 'bottom-left' });
        toast.default('Bottom Center', { position: 'bottom-center' });
        toast.success('Bottom Right', { position: 'bottom-right' });
      }, 500);
    }, []);
    return <div className="w-[600px] h-[400px]" />;
  },
};
