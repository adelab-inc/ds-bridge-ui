import type { Meta, StoryObj } from '@storybook/react';
import { useState, useEffect } from 'react';

import { TitleSection, TitleSectionProps } from '../components/TitleSection';
import { Button } from '../components/Button';
import { Icon } from '../components/Icon';

type StoryArgs = TitleSectionProps & {
  actionCount: 0 | 1 | 2 | 3;
};

const ACTIONS = [
  <Button key="1" buttonType="tertiary" size="sm" label="Excel 다운로드" showStartIcon={false} showEndIcon={true} endIcon={<Icon name="external" size={16} />} />,
  <Button key="2" buttonType="secondary" size="sm" label="조회" showStartIcon={false} showEndIcon={false} />,
  <Button key="3" buttonType="primary" size="sm" label="등록" showStartIcon={false} showEndIcon={false} />,
];

const meta: Meta<StoryArgs> = {
  title: 'UI/TitleSection',
  component: TitleSection,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          'TitleSection은 페이지 상단의 제목, Breadcrumb, 액션 버튼을 표시하는 레이아웃 컴포넌트입니다.',
          'Breadcrumb 순서: (Menu4) > Menu3 > Menu2 > Title (높은 번호가 왼쪽, Title이 항상 마지막)',
          '',
          '| Figma Property | Code Prop | 타입 | 기본값 | 비고 |',
          '|---|---|---|---|---|',
          '| Title | `title` | `string` | (필수) | 페이지 제목 (h1) = breadcrumb 마지막 항목 (항상 Menu1) |',
          '| Menu2 | `menu2` | `string` | — | Title 바로 위 상위 경로 |',
          '| Menu3 | `menu3` | `string` | — | Menu2 위 상위 경로 |',
          '| Menu4 | `menu4` | `string` | — | Menu3 위 최상위 경로 |',
          '| Show Breadcrumb | `showBreadcrumb` | `boolean` | `true` | Breadcrumb 섹션 표시 여부 |',
          '| Show Menu2 | `showMenu2` | `boolean` | `true` | Menu2 표시 여부 |',
          '| Show Menu3 | `showMenu3` | `boolean` | `true` | Menu3 표시 여부 |',
          '| Show Menu4 | `showMenu4` | `boolean` | `false` | Menu4 표시 여부 |',
          '| favorite | `favorite` | `boolean` | — | 즐겨찾기 상태 (undefined=미표시, false=☆, true=★) |',
          '| — | `onFavoriteChange` | `(v: boolean) => void` | — | 즐겨찾기 토글 콜백 |',
          '| — | `children` | `ReactNode` | — | 우측 액션 영역 (코드 전용) |',
          '| — | `mode` | `"base" \\| "compact"` | `"base"` | CVA variant (공통) |',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    title: {
      control: 'text',
      description: 'Figma: Title. 페이지 제목 (h1) = breadcrumb 마지막 항목 (항상 Menu1)',
    },
    menu2: {
      control: 'text',
      description: 'Figma: Menu2. Title 바로 위 상위 경로',
    },
    menu3: {
      control: 'text',
      description: 'Figma: Menu3. Menu2 위 상위 경로',
    },
    menu4: {
      control: 'text',
      description: 'Figma: Menu4. Menu3 위 최상위 경로 (showMenu4=true일 때 표시)',
    },
    showBreadcrumb: {
      control: 'boolean',
      description: 'Figma: Show Breadcrumb. Breadcrumb 섹션 표시 여부',
    },
    showMenu2: {
      control: 'boolean',
      description: 'Figma: Show Menu2. Menu2 표시 여부',
    },
    showMenu3: {
      control: 'boolean',
      description: 'Figma: Show Menu3. Menu3 표시 여부',
    },
    showMenu4: {
      control: 'boolean',
      description: 'Figma: Show Menu4. Menu4 표시 여부',
    },
    favorite: {
      control: 'boolean',
      description: 'Figma: favorite. 즐겨찾기 상태 (false=☆, true=★). 별 클릭 시 토글됩니다.',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'CVA variant. 레이아웃 모드',
    },
    actionCount: {
      control: { type: 'inline-radio' },
      options: [0, 1, 2, 3],
      description: '액션 버튼 개수 (최대 3개)',
    },
    onFavoriteChange: { table: { disable: true } },
    children: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  render: ({ actionCount, favorite, ...args }: StoryArgs) => {
    const [isFavorited, setIsFavorited] = useState(favorite);

    useEffect(() => {
      setIsFavorited(favorite);
    }, [favorite]);

    return (
      <TitleSection
        {...args}
        favorite={isFavorited}
        onFavoriteChange={setIsFavorited}
      >
        {actionCount > 0 ? ACTIONS.slice(0, actionCount) : undefined}
      </TitleSection>
    );
  },
  args: {
    title: '개인고객리스트',
    menu2: '고객관리',
    menu3: '고객관리',
    menu4: 'Menu4',
    showBreadcrumb: true,
    showMenu2: true,
    showMenu3: true,
    showMenu4: false,
    favorite: false,
    mode: 'base',
    actionCount: 0,
  },
};
