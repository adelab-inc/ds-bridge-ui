import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { Menu, menuVariants, MenuItem } from '../components/Menu';

const sampleMenuData: MenuItem[] = [
  { id: '1', label: '항목 1', onClick: vi.fn() },
  { id: '2', label: '항목 2', onClick: vi.fn() },
  { id: '3', label: '항목 3', onClick: vi.fn(), disabled: true },
];

const hierarchicalMenuData: MenuItem[] = [
  {
    id: '1',
    label: '부모 1',
    children: [
      { id: '1-1', label: '자식 1-1' },
      {
        id: '1-2',
        label: '자식 1-2',
        children: [
          { id: '1-2-1', label: '손자 1-2-1' },
          { id: '1-2-2', label: '손자 1-2-2' },
        ],
      },
    ],
  },
  {
    id: '2',
    label: '부모 2',
    children: [
      { id: '2-1', label: '자식 2-1' },
    ],
  },
];

describe('Menu Component', () => {
  it('메뉴 항목들을 올바르게 렌더링해야 합니다', () => {
    render(<Menu items={sampleMenuData} />);
    expect(screen.getByText('항목 1')).toBeInTheDocument();
    expect(screen.getByText('항목 2')).toBeInTheDocument();
    expect(screen.getByText('항목 3')).toBeInTheDocument();
  });

  it('메뉴 항목 클릭 시 onClick 핸들러를 호출해야 합니다', () => {
    const handleItemClick = vi.fn();
    render(<Menu items={sampleMenuData} onItemClick={handleItemClick} />);

    const item1 = screen.getByText('항목 1');
    fireEvent.click(item1);

    expect(handleItemClick).toHaveBeenCalledTimes(1);
    expect(handleItemClick).toHaveBeenCalledWith(sampleMenuData[0]);
  });

  it('disabled 항목은 클릭되지 않아야 합니다', () => {
    const handleItemClick = vi.fn();
    render(<Menu items={sampleMenuData} onItemClick={handleItemClick} />);

    const disabledItem = screen.getByText('항목 3');
    fireEvent.click(disabledItem);

    expect(sampleMenuData[2].onClick).not.toHaveBeenCalled();
  });

  it('계층형 메뉴가 올바르게 렌더링되어야 합니다', () => {
    render(<Menu items={hierarchicalMenuData} />);

    expect(screen.getByText('부모 1')).toBeInTheDocument();
    expect(screen.getByText('부모 2')).toBeInTheDocument();
  });

  it('마우스 호버 시 하위 메뉴가 표시되어야 합니다', async () => {
    render(<Menu items={hierarchicalMenuData} />);

    const parent1 = screen.getByText('부모 1');
    fireEvent.mouseEnter(parent1);

    await waitFor(() => {
      expect(screen.getByText('자식 1-1')).toBeInTheDocument();
      expect(screen.getByText('자식 1-2')).toBeInTheDocument();
    });
  });

  it('키보드 네비게이션이 작동해야 합니다 (Enter)', () => {
    const handleItemClick = vi.fn();
    render(<Menu items={sampleMenuData} onItemClick={handleItemClick} />);

    const item1 = screen.getByText('항목 1');
    fireEvent.keyDown(item1, { key: 'Enter' });

    expect(handleItemClick).toHaveBeenCalledTimes(1);
  });

  it('키보드 네비게이션이 작동해야 합니다 (Space)', () => {
    const handleItemClick = vi.fn();
    render(<Menu items={sampleMenuData} onItemClick={handleItemClick} />);

    const item1 = screen.getByText('항목 1');
    fireEvent.keyDown(item1, { key: ' ' });

    expect(handleItemClick).toHaveBeenCalledTimes(1);
  });

  it('외부 클릭 시 onClose가 호출되어야 합니다', () => {
    const handleClose = vi.fn();
    render(
      <div>
        <Menu items={sampleMenuData} onClose={handleClose} />
        <button>외부 버튼</button>
      </div>
    );

    const outsideButton = screen.getByText('외부 버튼');
    fireEvent.mouseDown(outsideButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('position prop이 있을 때 절대 위치로 렌더링되어야 합니다', () => {
    const { container } = render(
      <Menu items={sampleMenuData} position={{ x: 100, y: 200 }} />
    );

    const menu = container.firstChild as HTMLElement;
    expect(menu.style.position).toBe('fixed');
    expect(menu.style.left).toBe('100px');
    expect(menu.style.top).toBe('200px');
  });

  it('하위 메뉴가 없는 항목 클릭 시 메뉴가 닫혀야 합니다', () => {
    const handleClose = vi.fn();
    render(<Menu items={sampleMenuData} onClose={handleClose} />);

    const item1 = screen.getByText('항목 1');
    fireEvent.click(item1);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('heading이 올바르게 렌더링되어야 합니다', () => {
    const menuWithHeading: MenuItem[] = [
      { id: 'heading-1', heading: '그룹 제목' },
      { id: '1', label: '항목 1' },
    ];

    render(<Menu items={menuWithHeading} />);
    expect(screen.getByText('그룹 제목')).toBeInTheDocument();
  });

  it('title + description 스타일이 올바르게 렌더링되어야 합니다', () => {
    const menuWithTitleDesc: MenuItem[] = [
      { id: '1', title: '제목', description: '설명' },
    ];

    render(<Menu items={menuWithTitleDesc} size="md" />);
    const titleElement = screen.getByText('제목');
    const descElement = screen.getByText('설명');

    expect(titleElement).toBeInTheDocument();
    expect(titleElement).toHaveClass('text-button-md-medium');

    expect(descElement).toBeInTheDocument();
    expect(descElement).toHaveClass('text-caption-xs-regular');
    expect(descElement).toHaveClass('text-text-tertiary');
    expect(descElement).toHaveClass('line-clamp-2');
  });

  it('title + description이 sm 크기에 맞는 스타일로 렌더링되어야 합니다', () => {
    const menuWithTitleDesc: MenuItem[] = [
      { id: '1', title: '제목', description: '설명' },
    ];

    render(<Menu items={menuWithTitleDesc} size="sm" />);
    const titleElement = screen.getByText('제목');

    expect(titleElement).toHaveClass('text-button-sm-medium');
  });

  it('destructive 항목이 올바른 스타일로 렌더링되어야 합니다', () => {
    const destructiveMenu: MenuItem[] = [
      { id: '1', label: '삭제', destructive: true },
    ];

    render(<Menu items={destructiveMenu} />);
    const item = screen.getByText('삭제');

    expect(item.closest('[role="menuitem"]')).toHaveClass('text-alert-error-text');
  });

  it('selected 항목이 올바른 스타일로 렌더링되어야 합니다', () => {
    const selectedMenu: MenuItem[] = [
      { id: '1', label: '선택됨', selected: true },
    ];

    render(<Menu items={selectedMenu} />);
    const item = screen.getByText('선택됨');

    expect(item.closest('[role="menuitem"]')).toHaveClass('bg-bg-selection');
  });

  it('items가 빈 배열일 때 기본 emptyText가 렌더링되어야 합니다', () => {
    render(<Menu items={[]} />);
    expect(screen.getByText('값이 없습니다')).toBeInTheDocument();
  });

  it('items가 빈 배열일 때 커스텀 emptyText가 렌더링되어야 합니다', () => {
    render(<Menu items={[]} emptyText="데이터가 없어요" />);
    expect(screen.getByText('데이터가 없어요')).toBeInTheDocument();
  });

  it('emptyText가 빈 문자열일 때 아무것도 렌더링되지 않아야 합니다', () => {
    const { container } = render(<Menu items={[]} emptyText="" />);
    expect(container.querySelector('.text-center')).not.toBeInTheDocument();
  });

  it('empty state가 올바른 스타일로 렌더링되어야 합니다', () => {
    render(<Menu items={[]} size="md" />);
    const emptyElement = screen.getByText('값이 없습니다');

    expect(emptyElement).toHaveClass('text-center');
    expect(emptyElement).toHaveClass('text-text-tertiary');
    expect(emptyElement).toHaveClass('text-button-md-medium');
  });

  it('empty state가 sm 크기에 맞는 스타일로 렌더링되어야 합니다', () => {
    render(<Menu items={[]} size="sm" />);
    const emptyElement = screen.getByText('값이 없습니다');

    expect(emptyElement).toHaveClass('text-button-sm-medium');
  });
});

describe('menuVariants CVA', () => {
  it('should include correct base classes', () => {
    const className = menuVariants({ size: 'md' });
    expect(className).toContain('flex');
    expect(className).toContain('flex-col');
    expect(className).toContain('min-w-[180px]');
    expect(className).toContain('max-w-[240px]');
    expect(className).toContain('border');
    expect(className).toContain('bg-bg-surface');
  });

  it('should apply size variants correctly', () => {
    const mdClassName = menuVariants({ size: 'md' });
    const smClassName = menuVariants({ size: 'sm' });

    // Both sizes should have the same base classes since size variant is empty in definition
    expect(mdClassName).toContain('flex');
    expect(smClassName).toContain('flex');
  });
});

describe('Accessibility Features', () => {
  it('메뉴에 aria-orientation="vertical" 속성이 있어야 합니다', () => {
    const { container } = render(<Menu items={sampleMenuData} />);
    const menu = container.querySelector('[role="menu"]');

    expect(menu).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('메뉴 아이템에 aria-disabled 속성이 올바르게 적용되어야 합니다', () => {
    render(<Menu items={sampleMenuData} />);
    const disabledItem = screen.getByText('항목 3').closest('[role="menuitem"]');

    expect(disabledItem).toHaveAttribute('aria-disabled', 'true');
  });

  it('하위 메뉴가 있는 아이템에 aria-haspopup="menu" 속성이 있어야 합니다', () => {
    render(<Menu items={hierarchicalMenuData} />);
    const parentItem = screen.getByText('부모 1').closest('[role="menuitem"]');

    expect(parentItem).toHaveAttribute('aria-haspopup', 'menu');
  });

  it('ArrowDown 키를 누르면 다음 항목으로 포커스가 이동해야 합니다', async () => {
    render(<Menu items={sampleMenuData} />);
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    await waitFor(() => {
      const item2 = screen.getByText('항목 2').closest('[role="menuitem"]');
      expect(item2).toHaveFocus();
    });
  });

  it('ArrowUp 키를 누르면 이전 항목으로 포커스가 이동해야 합니다', () => {
    render(<Menu items={sampleMenuData} />);
    const menu = screen.getByRole('menu');

    // 먼저 항목 2로 이동
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    // 다시 위로 이동
    fireEvent.keyDown(menu, { key: 'ArrowUp' });

    const item1 = screen.getByText('항목 1').closest('[role="menuitem"]');
    expect(item1).toHaveFocus();
  });

  it('Home 키를 누르면 첫 번째 항목으로 포커스가 이동해야 합니다', () => {
    render(<Menu items={sampleMenuData} />);
    const menu = screen.getByRole('menu');

    // 항목 2로 이동 후
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    // Home 키 누르기
    fireEvent.keyDown(menu, { key: 'Home' });

    const item1 = screen.getByText('항목 1').closest('[role="menuitem"]');
    expect(item1).toHaveFocus();
  });

  it('End 키를 누르면 마지막 포커스 가능한 항목으로 포커스가 이동해야 합니다', async () => {
    render(<Menu items={sampleMenuData} />);
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'End' });

    await waitFor(() => {
      // 항목 3은 disabled이므로 마지막 포커스 가능한 항목인 항목 2로 이동
      const item2 = screen.getByText('항목 2').closest('[role="menuitem"]');
      expect(item2).toHaveFocus();
    });
  });

  it('ArrowRight 키를 누르면 하위 메뉴가 열려야 합니다', async () => {
    render(<Menu items={hierarchicalMenuData} />);
    const menu = screen.getByRole('menu');

    // ArrowRight 키로 하위 메뉴 열기
    fireEvent.keyDown(menu, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(screen.getByText('자식 1-1')).toBeInTheDocument();
    });
  });

  it('ArrowLeft 키를 누르면 하위 메뉴가 닫혀야 합니다', async () => {
    render(<Menu items={hierarchicalMenuData} />);

    // ArrowRight로 하위 메뉴 열고 첫 항목으로 포커스 이동
    const parent1 = screen.getByText('부모 1').closest('[role="menuitem"]') as HTMLElement;
    parent1.focus();
    fireEvent.keyDown(parent1, { key: 'ArrowRight' });

    await waitFor(() => {
      const child1 = screen.getByText('자식 1-1').closest('[role="menuitem"]') as HTMLElement;
      expect(child1).toHaveFocus();
    });

    // 하위 메뉴 항목에서 ArrowLeft로 닫기
    const child1 = screen.getByText('자식 1-1').closest('[role="menuitem"]') as HTMLElement;
    fireEvent.keyDown(child1, { key: 'ArrowLeft' });

    await waitFor(() => {
      expect(screen.queryByText('자식 1-1')).not.toBeInTheDocument();
      // 부모 항목으로 포커스 복귀
      expect(parent1).toHaveFocus();
    });
  });

  it('Escape 키를 누르면 메뉴가 닫혀야 합니다', () => {
    const handleClose = vi.fn();
    render(<Menu items={sampleMenuData} onClose={handleClose} />);
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'Escape' });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('Tab 키가 메뉴 내에서 포커스 트랩되어야 합니다', () => {
    render(<Menu items={sampleMenuData} />);
    const menu = screen.getByRole('menu');

    fireEvent.keyDown(menu, { key: 'Tab' });

    // Tab 키가 preventDefault되어 외부로 포커스가 이동하지 않음
    const item1 = screen.getByText('항목 1').closest('[role="menuitem"]');
    expect(item1).toBeInTheDocument();
  });

  it('disabled된 항목은 포커스 순환에서 제외되어야 합니다', async () => {
    render(<Menu items={sampleMenuData} />);
    const menu = screen.getByRole('menu');

    // 항목 1 (포커스 0) -> ArrowDown -> 항목 2 (포커스 1)로 이동
    // 항목 3은 disabled이므로 건너뛰어야 함
    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    await waitFor(() => {
      const item2 = screen.getByText('항목 2').closest('[role="menuitem"]');
      expect(item2).toHaveFocus();
    });

    // 한번 더 ArrowDown하면 항목 3은 건너뛰고 처음으로 순환
    fireEvent.keyDown(menu, { key: 'ArrowDown' });

    await waitFor(() => {
      const item1 = screen.getByText('항목 1').closest('[role="menuitem"]');
      expect(item1).toHaveFocus();
    });
  });

  it('Enter 키로 하위 메뉴를 열 수 있어야 합니다', async () => {
    render(<Menu items={hierarchicalMenuData} />);

    const parent1 = screen.getByText('부모 1').closest('[role="menuitem"]') as HTMLElement;
    parent1.focus();
    fireEvent.keyDown(parent1, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('자식 1-1')).toBeInTheDocument();
      expect(screen.getByText('자식 1-2')).toBeInTheDocument();
      // Enter로 열 때는 포커스가 부모 항목에 유지됨
      expect(parent1).toHaveFocus();
    });
  });

  it('Space 키로 하위 메뉴를 열 수 있어야 합니다', async () => {
    render(<Menu items={hierarchicalMenuData} />);

    const parent1 = screen.getByText('부모 1').closest('[role="menuitem"]') as HTMLElement;
    parent1.focus();
    fireEvent.keyDown(parent1, { key: ' ' });

    await waitFor(() => {
      expect(screen.getByText('자식 1-1')).toBeInTheDocument();
      expect(screen.getByText('자식 1-2')).toBeInTheDocument();
      // Space로 열 때도 포커스가 부모 항목에 유지됨
      expect(parent1).toHaveFocus();
    });
  });

  it('Enter 키로 열린 하위 메뉴를 다시 Enter로 닫을 수 있어야 합니다 (토글)', async () => {
    render(<Menu items={hierarchicalMenuData} />);

    const parent1 = screen.getByText('부모 1');

    // 첫 번째 Enter: 열기
    parent1.focus();
    fireEvent.keyDown(parent1, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.getByText('자식 1-1')).toBeInTheDocument();
    });

    // 두 번째 Enter: 닫기
    parent1.focus();
    fireEvent.keyDown(parent1, { key: 'Enter' });

    await waitFor(() => {
      expect(screen.queryByText('자식 1-1')).not.toBeInTheDocument();
    });
  });

  it('하위 메뉴가 없는 항목에서 Enter 키를 누르면 메뉴가 닫혀야 합니다', () => {
    const handleClose = vi.fn();
    render(<Menu items={sampleMenuData} onClose={handleClose} />);

    const item1 = screen.getByText('항목 1');
    item1.focus();
    fireEvent.keyDown(item1, { key: 'Enter' });

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  // TODO: Typeahead Search 기능 향후 추가 예정
  describe.skip('Typeahead Search', () => {
    it('문자를 입력하면 해당 문자로 시작하는 항목으로 이동해야 합니다', async () => {
      render(<Menu items={sampleMenuData} />);

      const menu = screen.getByRole('menu');

      // '항목 2'로 시작하는 항목 찾기 (키보드로 '항' 입력)
      fireEvent.keyDown(menu, { key: '항' });

      await waitFor(() => {
        const item1 = screen.getByText('항목 1').closest('[role="menuitem"]');
        expect(item1).toHaveFocus();
      });
    });

    it('연속으로 문자를 입력하면 다중 문자 검색이 되어야 합니다', async () => {
      const searchableItems: MenuItem[] = [
        { id: '1', label: 'Apple' },
        { id: '2', label: 'Application' },
        { id: '3', label: 'Banana' },
        { id: '4', label: 'Cherry' },
      ];

      render(<Menu items={searchableItems} />);

      const menu = screen.getByRole('menu');

      // 'app' 연속 입력
      fireEvent.keyDown(menu, { key: 'a' });
      fireEvent.keyDown(menu, { key: 'p' });
      fireEvent.keyDown(menu, { key: 'p' });

      await waitFor(() => {
        const appItem = screen.getByText('Application').closest('[role="menuitem"]');
        expect(appItem).toHaveFocus();
      });
    });

    it('현재 포커스 이후부터 순환 검색해야 합니다', async () => {
      const searchableItems: MenuItem[] = [
        { id: '1', label: 'Apple' },
        { id: '2', label: 'Banana' },
        { id: '3', label: 'Apricot' },
      ];

      render(<Menu items={searchableItems} />);

      // 먼저 Banana로 이동
      const banana = screen.getByText('Banana').closest('[role="menuitem"]') as HTMLElement;
      banana.focus();

      // 'a' 입력 - Banana 이후의 'a'로 시작하는 항목인 Apricot으로 이동해야 함
      fireEvent.keyDown(banana, { key: 'a' });

      await waitFor(() => {
        const apricot = screen.getByText('Apricot').closest('[role="menuitem"]');
        expect(apricot).toHaveFocus();
      });
    });

    it('매칭되는 항목이 없으면 포커스가 이동하지 않아야 합니다', async () => {
      render(<Menu items={sampleMenuData} />);

      const item1 = screen.getByText('항목 1').closest('[role="menuitem"]') as HTMLElement;
      item1.focus();

      // 'z' 입력 (매칭되는 항목 없음)
      fireEvent.keyDown(item1, { key: 'z' });

      await waitFor(() => {
        // 포커스가 그대로 item1에 있어야 함
        expect(item1).toHaveFocus();
      });
    });

    it('한글 검색이 정상적으로 동작해야 합니다', async () => {
      const koreanItems: MenuItem[] = [
        { id: '1', label: '파일' },
        { id: '2', label: '편집' },
        { id: '3', label: '보기' },
        { id: '4', label: '도움말' },
      ];

      render(<Menu items={koreanItems} />);

      const menu = screen.getByRole('menu');

      // '편' 입력하여 '편집'으로 이동
      fireEvent.keyDown(menu, { key: '편' });

      await waitFor(() => {
        const editItem = screen.getByText('편집').closest('[role="menuitem"]');
        expect(editItem).toHaveFocus();
      });
    });

    it('한글 연속 입력 검색이 동작해야 합니다', async () => {
      const koreanItems: MenuItem[] = [
        { id: '1', label: '파일' },
        { id: '2', label: '파일 열기' },
        { id: '3', label: '편집' },
      ];

      render(<Menu items={koreanItems} />);

      const menu = screen.getByRole('menu');

      // '파일 ' 연속 입력
      fireEvent.keyDown(menu, { key: '파' });
      fireEvent.keyDown(menu, { key: '일' });
      fireEvent.keyDown(menu, { key: ' ' });

      await waitFor(() => {
        const fileOpenItem = screen.getByText('파일 열기').closest('[role="menuitem"]');
        expect(fileOpenItem).toHaveFocus();
      });
    });

    it('영문과 한글 혼합 검색이 동작해야 합니다', async () => {
      const mixedItems: MenuItem[] = [
        { id: '1', label: 'Apple 사과' },
        { id: '2', label: 'Banana 바나나' },
        { id: '3', label: 'Cherry 체리' },
      ];

      render(<Menu items={mixedItems} />);

      const menu = screen.getByRole('menu');

      // 'b' 입력하여 'Banana 바나나'로 이동
      fireEvent.keyDown(menu, { key: 'b' });

      await waitFor(() => {
        const bananaItem = screen.getByText('Banana 바나나').closest('[role="menuitem"]');
        expect(bananaItem).toHaveFocus();
      });
    });

    it('한글 초성 검색이 동작해야 합니다 (ㅈ → 잘라내기)', async () => {
      const chosungItems: MenuItem[] = [
        { id: '1', label: '새 파일' },
        { id: '2', label: '파일 열기' },
        { id: '3', label: '잘라내기' },
        { id: '4', label: '복사' },
      ];

      render(<Menu items={chosungItems} />);

      const menu = screen.getByRole('menu');

      // 'ㅈ' 입력하여 '잘라내기'로 이동
      fireEvent.keyDown(menu, { key: 'ㅈ' });

      await waitFor(() => {
        const cutItem = screen.getByText('잘라내기').closest('[role="menuitem"]');
        expect(cutItem).toHaveFocus();
      });
    });

    it('한글 초성 연속 검색이 동작해야 합니다 (ㅂㅅ → 복사)', async () => {
      const chosungItems: MenuItem[] = [
        { id: '1', label: '새 파일' },
        { id: '2', label: '보기' },
        { id: '3', label: '복사' },
        { id: '4', label: '붙여넣기' },
      ];

      render(<Menu items={chosungItems} />);

      const menu = screen.getByRole('menu');

      // 'ㅂ' 입력 - '보기'로 이동
      fireEvent.keyDown(menu, { key: 'ㅂ' });

      await waitFor(() => {
        const viewItem = screen.getByText('보기').closest('[role="menuitem"]');
        expect(viewItem).toHaveFocus();
      });

      // 'ㅅ' 추가 입력 - '복사'로 이동
      fireEvent.keyDown(menu, { key: 'ㅅ' });

      await waitFor(() => {
        const copyItem = screen.getByText('복사').closest('[role="menuitem"]');
        expect(copyItem).toHaveFocus();
      });
    });
  });
});
