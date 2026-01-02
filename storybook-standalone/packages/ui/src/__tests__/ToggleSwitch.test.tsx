import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { ToggleSwitch, toggleSwitchVariants } from '../components/ToggleSwitch';

describe('ToggleSwitch Component', () => {
  it('올바르게 렌더링되어야 합니다', () => {
    render(<ToggleSwitch aria-label="Test switch" />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeInTheDocument();
  });

  it('checked prop이 false일 때 체크되지 않은 상태여야 합니다', () => {
    render(<ToggleSwitch checked={false} aria-label="Test switch" />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).not.toBeChecked();
  });

  it('checked prop이 true일 때 체크된 상태여야 합니다', () => {
    render(<ToggleSwitch checked={true} aria-label="Test switch" />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeChecked();
  });

  it('disabled prop이 true일 때 비활성화되어야 합니다', () => {
    render(<ToggleSwitch disabled aria-label="Test switch" />);
    const switchElement = screen.getByRole('switch');
    expect(switchElement).toBeDisabled();
  });

  it('클릭 시 onChange 핸들러를 호출해야 합니다', () => {
    const handleChange = vi.fn();
    render(<ToggleSwitch checked={false} onChange={handleChange} aria-label="Test switch" />);
    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('disabled 상태에서는 onChange 핸들러가 호출되지 않아야 합니다', () => {
    const handleChange = vi.fn();
    render(<ToggleSwitch disabled onChange={handleChange} aria-label="Test switch" />);
    const switchElement = screen.getByRole('switch');
    fireEvent.click(switchElement);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it('aria-checked 속성이 checked 상태를 반영해야 합니다', () => {
    const { rerender } = render(<ToggleSwitch checked={false} aria-label="Test switch" />);
    let switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'false');

    rerender(<ToggleSwitch checked={true} aria-label="Test switch" />);
    switchElement = screen.getByRole('switch');
    expect(switchElement).toHaveAttribute('aria-checked', 'true');
  });

  it('aria-label prop을 올바르게 적용해야 합니다', () => {
    render(<ToggleSwitch aria-label="Custom label" />);
    const switchElement = screen.getByLabelText('Custom label');
    expect(switchElement).toBeInTheDocument();
  });
});

describe('toggleSwitchVariants CVA', () => {
  it('checked가 false일 때 올바른 클래스를 포함해야 합니다', () => {
    const className = toggleSwitchVariants({ checked: false, disabled: false });
    expect(className).toContain('bg-control-bg-off');
  });

  it('checked가 true일 때 올바른 클래스를 포함해야 합니다', () => {
    const className = toggleSwitchVariants({ checked: true, disabled: false });
    expect(className).toContain('bg-control-bg-on');
  });

  it('disabled가 true일 때 올바른 클래스를 포함해야 합니다', () => {
    const className = toggleSwitchVariants({ checked: false, disabled: true });
    expect(className).toContain('bg-control-bg-disabled');
    expect(className).toContain('cursor-not-allowed');
  });

  it('기본 클래스를 포함해야 합니다', () => {
    const className = toggleSwitchVariants({});
    expect(className).toContain('w-[32px]');
    expect(className).toContain('h-[18px]');
    expect(className).toContain('rounded-full');
    expect(className).toContain('transition-colors');
    expect(className).toContain('duration-300');
  });
});
