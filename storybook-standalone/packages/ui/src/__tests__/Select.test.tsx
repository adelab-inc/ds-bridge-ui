import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import { Select } from '../components/Select';

const defaultOptions = [
  { value: 'option1', label: '옵션 1' },
  { value: 'option2', label: '옵션 2' },
  { value: 'option3', label: '옵션 3' },
];

describe('Select Component', () => {
  test('renders select with label and helper text', () => {
    render(<Select id="test-select" label="선택 항목" helperText="도움말" options={defaultOptions} />);
    expect(screen.getByLabelText('선택 항목')).toBeInTheDocument();
    expect(screen.getByText('도움말')).toBeInTheDocument();
  });

  test('renders trigger with placeholder', () => {
    render(<Select id="test-select" options={defaultOptions} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
    expect(screen.getByText('선택하세요')).toBeInTheDocument();
  });

  test('renders with default value', () => {
    render(<Select id="test-select" defaultValue="option2" options={defaultOptions} />);
    expect(screen.getByText('옵션 2')).toBeInTheDocument();
  });

  test('opens menu on trigger click', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  test('closes menu on option selection', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    const option = screen.getByRole('menuitem', { name: '옵션 1' });
    await user.click(option);

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
      expect(screen.getByText('옵션 1')).toBeInTheDocument();
    });
  });

  test('calls onChange with selected value', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Select id="test-select" onChange={handleChange} options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    const option = screen.getByRole('menuitem', { name: '옵션 2' });
    await user.click(option);

    expect(handleChange).toHaveBeenCalledWith('option2');
  });

  test('opens menu with Enter key', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    trigger.focus();

    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  test('opens menu with Space key', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    trigger.focus();

    await user.keyboard(' ');

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  test('opens menu with ArrowDown key', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    trigger.focus();

    await user.keyboard('{ArrowDown}');

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });
  });

  test('closes menu with Escape key', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  test('renders disabled state', () => {
    render(<Select id="test-select" disabled options={defaultOptions} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
    expect(trigger).toHaveAttribute('tabIndex', '-1');
  });

  test('does not open menu when disabled', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" disabled options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    // Menu should not appear
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('renders error state with aria-invalid', () => {
    render(<Select id="test-select" error helperText="에러 메시지" options={defaultOptions} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('에러 메시지')).toBeInTheDocument();
  });

  test('renders small size', () => {
    render(<Select id="test-select" size="sm" options={defaultOptions} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toBeInTheDocument();
  });

  test('links helper text with aria-describedby', () => {
    render(<Select id="test-select" helperText="도움말" options={defaultOptions} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-describedby', 'test-select-helper-text');
  });

  test('links label with aria-labelledby', () => {
    render(<Select id="test-select" label="선택 항목" options={defaultOptions} />);
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-labelledby', 'test-select-label');
  });

  test('updates displayed value in controlled mode', async () => {
    const { rerender } = render(
      <Select id="test-select" value="option1" options={defaultOptions} />
    );
    expect(screen.getByText('옵션 1')).toBeInTheDocument();

    rerender(<Select id="test-select" value="option2" options={defaultOptions} />);
    expect(screen.getByText('옵션 2')).toBeInTheDocument();
  });

  test('shows custom placeholder', () => {
    render(<Select id="test-select" placeholder="항목을 선택해주세요" options={defaultOptions} />);
    expect(screen.getByText('항목을 선택해주세요')).toBeInTheDocument();
  });

  test('displays chevron icon that rotates when open', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    const icon = trigger.querySelector('svg');
    expect(icon).toBeInTheDocument();

    await user.click(trigger);

    await waitFor(() => {
      const iconParent = icon?.parentElement;
      expect(iconParent).toHaveClass('rotate-180');
    });
  });

  test('focuses trigger after selecting option', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    const option = screen.getByRole('menuitem', { name: '옵션 1' });
    await user.click(option);

    await waitFor(() => {
      expect(document.activeElement).toBe(trigger);
    });
  });

  test('marks selected option in menu', async () => {
    const user = userEvent.setup();
    render(<Select id="test-select" defaultValue="option2" options={defaultOptions} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      const selectedOption = screen.getByRole('menuitem', { name: '옵션 2' });
      // Menu 컴포넌트는 선택된 항목에 bg-bg-selection 클래스를 추가합니다
      expect(selectedOption).toHaveClass('bg-bg-selection');
    });
  });

  test('renders disabled options', async () => {
    const user = userEvent.setup();
    const optionsWithDisabled = [
      { value: 'option1', label: '옵션 1' },
      { value: 'option2', label: '옵션 2', disabled: true },
      { value: 'option3', label: '옵션 3' },
    ];

    render(<Select id="test-select" options={optionsWithDisabled} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      const disabledOption = screen.getByRole('menuitem', { name: '옵션 2' });
      expect(disabledOption).toHaveAttribute('aria-disabled', 'true');
    });
  });

  test('cannot select disabled option', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const optionsWithDisabled = [
      { value: 'option1', label: '옵션 1' },
      { value: 'option2', label: '옵션 2', disabled: true },
      { value: 'option3', label: '옵션 3' },
    ];

    render(<Select id="test-select" onChange={handleChange} options={optionsWithDisabled} />);

    const trigger = screen.getByRole('combobox');
    await user.click(trigger);

    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    const disabledOption = screen.getByRole('menuitem', { name: '옵션 2' });
    await user.click(disabledOption);

    // disabled 옵션 클릭 시 onChange가 호출되지 않아야 함
    expect(handleChange).not.toHaveBeenCalled();
  });
});
