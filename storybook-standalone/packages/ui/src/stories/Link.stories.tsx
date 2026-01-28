import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  createRouter,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router';
import { Link } from '../components/Link';

// Storybook을 위한 라우터 데코레이터
const TanStackRouterDecorator = (Story: React.ComponentType) => {
  // Story 컴포넌트를 렌더링하는 루트 라우트 설정
  const rootRoute = createRootRoute({
    component: () => (
      <>
        <Story />
        <Outlet />
      </>
    ),
  });

  // Link 컴포넌트가 참조할 수 있는 예시 라우트
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/' });
  const aboutRoute = createRoute({ getParentRoute: () => rootRoute, path: '/about' });

  const router = createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory(),
  });

  return <RouterProvider router={router} />;
};

const meta: Meta<typeof Link> = {
  title: 'UI/Link',
  component: Link,
  tags: ['autodocs'],
  decorators: [TanStackRouterDecorator],
  argTypes: {
    children: {
      control: 'text',
      description: 'Link 내부 텍스트',
    },
    variant: {
      control: 'select',
      options: [
        'on-hover-link',
        'on-hover-inherit',
        'always-link',
        'always-inherit',
        'none-link',
        'none-inherit',
      ],
      description: 'Link 스타일 variant',
    },
    size: {
      control: 'select',
      options: ['lg', 'md', 'sm'],
      description: 'Link 크기',
    },
    to: { table: { disable: true } },
    href: { table: { disable: true } },
    className: { table: { disable: true } },
    hash: { table: { disable: true } },
    state: { table: { disable: true } },
    from: { table: { disable: true } },
    _unsafe_ignoreRelative: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<typeof Link>;

export const Default: Story = {
  args: {
    to: '/',
    children: 'Link',
    variant: 'on-hover-link',
    size: 'md',
  },
};
