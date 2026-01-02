import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { Pagination } from '../components/Pagination/Pagination';

describe('Pagination Component', () => {
  const defaultProps = {
    totalCount: 100,
    pageSize: 10,
    currentPage: 1,
    onPageChange: vi.fn(),
  };

  it('페이지 번호를 올바르게 렌더링해야 합니다', () => {
    render(<Pagination {...defaultProps} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    // ... and so on, depending on siblingCount
  });

  it('다음 페이지 버튼 클릭 시 onPageChange를 호출해야 합니다', () => {
    render(<Pagination {...defaultProps} currentPage={5} />);
    const nextPageButton = screen.getByLabelText('Next Page');
    fireEvent.click(nextPageButton);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(6);
  });

  it('이전 페이지 버튼 클릭 시 onPageChange를 호출해야 합니다', () => {
    render(<Pagination {...defaultProps} currentPage={5} />);
    const prevPageButton = screen.getByLabelText('Previous Page');
    fireEvent.click(prevPageButton);
    expect(defaultProps.onPageChange).toHaveBeenCalledWith(4);
  });

  it('첫 페이지에서는 이전/처음 버튼이 비활성화되어야 합니다', () => {
    render(<Pagination {...defaultProps} currentPage={1} />);
    expect(screen.getByLabelText('Previous Page')).toBeDisabled();
    expect(screen.getByLabelText('First Page')).toBeDisabled();
  });

  it('마지막 페이지에서는 다음/마지막 버튼이 비활성화되어야 합니다', () => {
    render(<Pagination {...defaultProps} currentPage={10} />);
    expect(screen.getByLabelText('Next Page')).toBeDisabled();
    expect(screen.getByLabelText('Last Page')).toBeDisabled();
  });

  it('disabled prop이 true일 때 모든 버튼이 비활성화되어야 합니다', () => {
    render(<Pagination {...defaultProps} disabled />);
    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('simple variant를 올바르게 렌더링해야 합니다', () => {
    render(<Pagination {...defaultProps} variant="simple" totalPages={10} />);
    expect(screen.getByText('1 / 10')).toBeInTheDocument();
  });
});
