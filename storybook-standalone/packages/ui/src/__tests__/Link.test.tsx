import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  createRouter,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  Outlet,
} from '@tanstack/react-router';
import { Link } from '../components/Link';

// 테스트를 위한 헬퍼 함수
const renderWithRouter = (ui: React.ReactElement) => {
  const RootComponent = () => <Outlet />;
  const TestComponent = () => ui;

  const rootRoute = createRootRoute({ component: RootComponent });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: TestComponent });
  const usersRoute = createRoute({ getParentRoute: () => rootRoute, path: '/users', component: TestComponent });
  const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: TestComponent });

  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, usersRoute, adminRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  return render(<RouterProvider router={router} />);
};

describe('Link Component', () => {
  it('내부 링크("to" prop)를 올바르게 렌더링해야 합니다', async () => {
    renderWithRouter(<Link to="/users">Users</Link>);

    const linkElement = await screen.findByRole('link', { name: /Users/i });
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', '/users');
  });

  it('외부 링크("href" prop)를 올바르게 렌더링해야 합니다', () => {
    // 외부 링크는 라우터 컨텍스트가 필요 없으므로 직접 렌더링해도 무방합니다.
    render(<Link href="https://example.com">External</Link>);

    const linkElement = screen.getByRole('link', { name: /External/i });
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', 'https://example.com');
  });

  it('외부 링크에 target="_blank"와 rel="noopener noreferrer"를 추가해야 합니다', () => {
    render(<Link href="https://example.com">External</Link>);

    const linkElement = screen.getByRole('link', { name: /External/i });
    expect(linkElement).toHaveAttribute('target', '_blank');
    expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('내부 링크에는 target과 rel 속성이 없어야 합니다', async () => {
    renderWithRouter(<Link to="/admin">Admin</Link>);

    const linkElement = await screen.findByRole('link', { name: /Admin/i });
    expect(linkElement).not.toHaveAttribute('target');
    expect(linkElement).not.toHaveAttribute('rel');
  });

  it('variant와 size에 따라 올바른 클래스를 적용해야 합니다', async () => {
    renderWithRouter(
      <Link to="/" variant="always-link" size="lg">
        Styled Link
      </Link>,
    );

    const linkElement = await screen.findByRole('link', { name: /Styled Link/i });
    expect(linkElement).toHaveClass('text-text-semantic-info');
    expect(linkElement).toHaveClass('underline');
    expect(linkElement).toHaveClass('text-body-lg-regular');
  });
});
