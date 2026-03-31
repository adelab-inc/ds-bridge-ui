import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { ActionBar, ActionBarProps } from '../components/ActionBar';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

const meta: Meta<ActionBarProps> = {
  title: 'UI/ActionBar',
  component: ActionBar,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          'ActionBar는 데이터 테이블/리스트에서 항목 선택 시 나타나는 플로팅 액션바 프리셋입니다.',
          '',
          '| Figma Property | Code Prop | 타입 | 기본값 | 비고 |',
          '|---|---|---|---|---|',
          '| Number | `count` | `number` | (필수) | 선택 항목 수, "N개 선택됨" 표시 |',
          '| Show Button1~5 | `children` | `ReactNode` | (필수) | 소비자가 Button(ghost-inverse) 직접 전달 |',
          '| Position | `position` | `"fixed" \\| "absolute"` | `"fixed"` | fixed: 뷰포트 하단 32px, absolute: 부모 하단 20px |',
          '| — | `visible` | `boolean` | `true` | 표시/숨김 + 애니메이션 |',
          '| — | `onClose` | `() => void` | — | X 버튼 클릭 콜백 |',
          '| — | `selectionLabel` | `string` | `"개 선택됨"` | i18n용 라벨 커스텀 |',
          '',
          '### 사용 가이드',
          '',
          '- **액션 버튼**: `Button` 컴포넌트에 `buttonType="ghost-inverse"` + `showStartIcon` 사용',
          '- **닫기 버튼**: 항상 표시, `onClose`로 콜백 전달',
          '- **애니메이션**: `visible` prop 변경 시 enter/exit 애니메이션 자동 적용',
          '- **배경**: `bg-bg-inverse` (#343a40) 디자인 토큰 사용',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    count: {
      control: 'number',
      description: 'Figma: `Number`. 선택된 항목 수',
    },
    position: { table: { disable: true } },
    visible: {
      control: 'boolean',
      description: '표시/숨김 (애니메이션 포함)',
    },
    selectionLabel: {
      control: 'text',
      description: 'i18n용 선택 라벨 커스텀 (기본: "개 선택됨")',
    },
    onClose: { table: { disable: true } },
    children: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<ActionBarProps>;

export const Default: Story = {
  render: (args) => {
    return (
      <div className="relative w-[800px] h-[300px] bg-bg-surface border border-border-default rounded-lg flex items-center justify-center">
        <p className="text-text-tertiary">테이블 영역</p>
        <ActionBar
          {...args}
          position="absolute"
          onClose={() => console.log('close')}
        >
          <Button
            buttonType="ghost-inverse"
            size="md"
            label="버튼1"
            showStartIcon={true}
            startIcon={<Icon name="blank" size={16} />}
            showEndIcon={false}
          />
          <Button
            buttonType="ghost-inverse"
            size="md"
            label="버튼2"
            showStartIcon={true}
            startIcon={<Icon name="blank" size={16} />}
            showEndIcon={false}
          />
        </ActionBar>
      </div>
    );
  },
  args: {
    count: 3,
    visible: true,
    selectionLabel: '개 선택됨',
  },
};

export const PositionFixed: Story = {
  render: (args) => {
    return (
      <ActionBar
        {...args}
        position="fixed"
        onClose={() => console.log('close')}
      >
        <Button
          buttonType="ghost-inverse"
          size="md"
          label="다운로드"
          showStartIcon={true}
          startIcon={<Icon name="blank" size={16} />}
          showEndIcon={false}
        />
        <Button
          buttonType="ghost-inverse"
          size="md"
          label="삭제"
          showStartIcon={true}
          startIcon={<Icon name="blank" size={16} />}
          showEndIcon={false}
        />
      </ActionBar>
    );
  },
  args: {
    count: 5,
    visible: true,
    selectionLabel: '개 선택됨',
  },
  parameters: {
    docs: {
      description: {
        story: '`position="fixed"`일 때 뷰포트 하단에 고정됩니다. 스크롤과 무관하게 항상 같은 위치에 표시됩니다.',
      },
    },
  },
};

export const ManyButtons: Story = {
  render: (args) => {
    const labels = [
      '복사', '이동', '다운로드', '인쇄', '공유',
      '보관', '삭제', '잠금', '해제', '즐겨찾기',
      '태그', '분류', '병합', '분할', '내보내기',
      '가져오기', '변환', '비교', '복원', '영구삭제',
    ];
    return (
      <div className="relative w-[1000px] h-[300px] bg-bg-surface border border-border-default rounded-lg flex items-center justify-center">
        <p className="text-text-tertiary">테이블 영역</p>
        <ActionBar
          {...args}
          position="absolute"
          onClose={() => console.log('close')}
        >
          {labels.map((label) => (
            <Button
              key={label}
              buttonType="ghost-inverse"
              size="md"
              label={label}
              showStartIcon={true}
              startIcon={<Icon name="blank" size={16} />}
              showEndIcon={false}
            />
          ))}
        </ActionBar>
      </div>
    );
  },
  args: {
    count: 20,
    visible: true,
    selectionLabel: '개 선택됨',
  },
  parameters: {
    docs: {
      description: {
        story: '버튼 20개를 배치한 극단 케이스입니다. `overflow-hidden`으로 넘치는 버튼이 잘려 표시됩니다.',
      },
    },
  },
};

export const ShowHide: Story = {
  render: () => {
    const [visible, setVisible] = useState(false);
    const [count, setCount] = useState(0);

    const handleSelect = () => {
      const newCount = count + 1;
      setCount(newCount);
      setVisible(true);
    };

    const handleClose = () => {
      setVisible(false);
      setCount(0);
    };

    return (
      <div className="relative w-[800px] h-[400px] bg-bg-surface border border-border-default rounded-lg flex flex-col items-center justify-center gap-4">
        <p className="text-text-tertiary">항목을 선택해보세요</p>
        <Button
          buttonType="tertiary"
          label="항목 선택"
          onClick={handleSelect}
          showStartIcon={false}
          showEndIcon={false}
        />
        <p className="text-body-sm-regular text-text-tertiary">
          선택 수: {count} | visible: {String(visible)}
        </p>
        <ActionBar
          count={count}
          position="absolute"
          visible={visible}
          onClose={handleClose}
        >
          <Button
            buttonType="ghost-inverse"
            size="md"
            label="다운로드"
            showStartIcon={true}
            startIcon={<Icon name="blank" size={16} />}
            showEndIcon={false}
          />
          <Button
            buttonType="ghost-inverse"
            size="md"
            label="삭제"
            showStartIcon={true}
            startIcon={<Icon name="blank" size={16} />}
            showEndIcon={false}
            onClick={handleClose}
          />
        </ActionBar>
      </div>
    );
  },
  argTypes: {
    count: { table: { disable: true } },
    visible: { table: { disable: true } },
    selectionLabel: { table: { disable: true } },
  },
  parameters: {
    controls: { disable: true },
    docs: {
      description: {
        story: '`visible` prop 토글 시 enter/exit 애니메이션을 확인할 수 있습니다. 버튼으로 직접 조작하세요.',
      },
    },
  },
};
