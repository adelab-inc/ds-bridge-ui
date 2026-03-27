import type { Meta, StoryObj } from '@storybook/react';
import {
  createRouter,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
} from '@tanstack/react-router';
import { Link } from '../components/Link';
import { LinkUnderline, LinkTone, Size, Interaction } from '../types';

// Storybook을 위한 라우터 데코레이터
const TanStackRouterDecorator = (Story: React.ComponentType) => {
  const rootRoute = createRootRoute({
    component: () => <Story />,
  });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  });

  return <RouterProvider router={router} />;
};

const meta: Meta<typeof Link> = {
  title: 'UI/Link',
  component: Link,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Underline` (on-hover/always/none) | `underline` | Figma 이름 그대로 사용. V1 `variant` 6개 flat 조합에서 밑줄 축만 분리 |',
          '| `Tone` (link/inherit) | `tone` | Figma 이름 그대로 사용. V1 `variant`에서 색상 축만 분리 |',
          '| `Size` (lg/md/sm) | `size` | 변경 없음 |',
          '| `Interaction` (default/hover) | `interaction` | Figma 상태 대응. 실제 동작은 CSS `:hover` pseudo-state로 처리 |',
          '| `Text` | `children` | Button과 달리 `children` 유지. 복합 요소 허용을 위해 ReactNode 타입 |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  decorators: [TanStackRouterDecorator],
  argTypes: {
    children: {
      control: 'text',
      description: 'Figma: `Text`. Link 내부 텍스트 (ReactNode)',
    },
    underline: {
      control: 'select',
      options: Object.values(LinkUnderline),
      description: 'Figma: `Underline`. 밑줄 스타일 (on-hover=호버시, always=항상, none=없음)',
    },
    tone: {
      control: 'select',
      options: Object.values(LinkTone),
      description: 'Figma: `Tone`. 색상 톤 (link=파란색, inherit=부모 색상 상속)',
    },
    size: {
      control: 'select',
      options: Object.values(Size),
      description: 'Figma: `Size`. Link 크기',
    },
    interaction: {
      control: 'select',
      options: ['default', 'hover'],
      description: 'Figma: `Interaction`. 상태 (CSS pseudo-state로 처리)',
    },
    to: { table: { disable: true } },
    href: { table: { disable: true } },
    className: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Link>;

export const Default: Story = {
  args: {
    to: '/',
    children: 'Link',
    underline: LinkUnderline.ON_HOVER,
    tone: LinkTone.LINK,
    size: Size.MD,
    interaction: Interaction.DEFAULT,
  },
};
