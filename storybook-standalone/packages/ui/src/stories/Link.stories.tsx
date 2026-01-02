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

// Go 템플릿 파싱 오류를 피하기 위해 스타일 객체를 변수로 분리
const wrapperStyle = { color: 'red', fontSize: '24px' };
const StyleWrapper = ({ children }: { children: React.ReactNode }) => (
  <div style={wrapperStyle}>
    {children}
  </div>
);

const meta: Meta<typeof Link> = {
  title: 'UI/Link',
  component: Link,
  tags: ['autodocs'],
  decorators: [TanStackRouterDecorator],
  argTypes: {
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
    },
    size: {
      control: 'select',
      options: ['lg', 'md', 'sm'],
    },
    children: {
      control: 'text',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Link>;

export const OnHoverLink: Story = {
  name: 'on-hover-link',
  args: {
    to: '/',
    children: 'Link',
    variant: 'on-hover-link',
    size: 'md',
  },
};

export const OnHoverInherit: Story = {
  name: 'on-hover-inherit',
  decorators: [
    Story => (
      <StyleWrapper>
        <Story />
      </StyleWrapper>
    ),
  ],
  args: {
    to: '/',
    children: 'Link',
    variant: 'on-hover-inherit',
    size: 'md',
  },
};

export const AlwaysLink: Story = {
  name: 'always-link',
  args: {
    to: '/about',
    children: 'Link',
    variant: 'always-link',
    size: 'md',
  },
};

export const AlwaysInherit: Story = {
  name: 'always-inherit',
  decorators: [
    Story => (
      <StyleWrapper>
        <Story />
      </StyleWrapper>
    ),
  ],
  args: {
    to: '/',
    children: 'Link',
    variant: 'always-inherit',
    size: 'md',
  },
};

export const NoneLink: Story = {
  name: 'none-link',
  args: {
    to: '/',
    children: 'Link',
    variant: 'none-link',
    size: 'md',
  },
};

export const NoneInherit: Story = {
  name: 'none-inherit',
  decorators: [
    Story => (
      <StyleWrapper>
        <Story />
      </StyleWrapper>
    ),
  ],
  args: {
    to: '/',
    children: 'Link',
    variant: 'none-inherit',
    size: 'md',
  },
};