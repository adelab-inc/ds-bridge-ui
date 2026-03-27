import type { Meta, StoryObj } from '@storybook/react';
import * as React from 'react';

import { OptionGroup } from '../components/OptionGroup';
import { Option } from '../components/Option';
import { Radio } from '../components/Radio';
import { Checkbox } from '../components/Checkbox';
import { Size, Mode, CheckboxValue, RadioValue } from '../types';

interface OptionGroupStoryArgs {
  label?: string;
  showLabel?: boolean;
  showAsterisk?: boolean;
  helptext?: string;
  showHelptext?: boolean;
  size?: 'sm' | 'md' | 'lg';
  mode?: 'base' | 'compact';
  orientation?: 'horizontal' | 'vertical';
  optionType?: 'radio' | 'checkbox';
}

const meta: Meta<OptionGroupStoryArgs> = {
  title: 'UI/OptionGroup',
  component: OptionGroup,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
## Figma ↔ Code 인터페이스 매핑

| Figma Property | Code Prop | 타입 | 설명 |
|---|---|---|---|
| Label | label | string | 그룹 제목 |
| Show Label | showLabel | boolean | 제목 표시 여부 |
| Show Asterisk | showAsterisk | boolean | 필수 표시 (별표) |
| Helptext | helptext | string | 도움말 텍스트 |
| Show Helptext | showHelptext | boolean | 도움말 표시 여부 |
| Size | size | 'sm' \\| 'md' \\| 'lg' | 크기 |
| Orientation | orientation | 'horizontal' \\| 'vertical' | 배치 방향 |

**Note**: Figma에서는 CheckboxGroup과 RadioGroup이 분리되어 있지만, 코드에서는 OptionGroup 하나로 통합 관리합니다.
children으로 전달되는 Option 내부의 Radio/Checkbox 타입에 따라 자동으로 구분됩니다.

## Option Size 전달 (Context API)

OptionGroup의 \`size\`는 Context API를 통해 자동으로 Option에 전달됩니다:

\`\`\`tsx
<OptionGroup size="lg">
  <Option label="옵션 1">  {/* size="lg" 자동 적용 */}
    <Radio />
  </Option>
</OptionGroup>
\`\`\`

**Size 우선순위**:
1. Option에 명시적으로 전달된 size prop
2. OptionGroup Context (자동 전달)
3. 기본값 'md' (단독 사용 시)

**컨트롤 크기**:
- sm → Radio/Checkbox 컨테이너 h-[20px]
- md → Radio/Checkbox 컨테이너 h-[24px]
- lg → Radio/Checkbox 컨테이너 h-[28px]

## V1 → V2 변경 사항

| V1 prop | V2 prop | 변경 이유 |
|---|---|---|
| title | label | Figma property 이름과 일치 |
| required | showAsterisk | Figma "Show Asterisk" boolean과 일치 |
| helperText | helptext | Figma property 명명 규칙 일치 |
| containerWidth | (제거) | Figma에서 고정 너비 사용 (size+orientation 조합별) |
| groupType | (제거) | children의 Option type으로 자동 감지 |
| — | showLabel | Figma "Show Label" 신규 추가 |
| — | showHelptext | Figma "Show Helptext" 신규 추가 |

## 너비 처리

실제 컴포넌트는 \`w-full\`로 부모 컨테이너에 맞춰 유연하게 동작합니다.
Storybook에서는 Figma 디자인 가이드에 따라 고정 너비로 표시됩니다:

### Figma 참조 너비 (Storybook 전용)
- **Vertical**: sm(244px), md(270px), lg(289px)
- **Horizontal**: sm(210px), md(225px), lg(243px)
        `,
      },
    },
  },
  argTypes: {
    label: {
      control: 'text',
      description: 'Figma: Label — 그룹 제목',
    },
    showLabel: {
      control: 'boolean',
      description: 'Figma: Show Label — 제목 표시 여부',
    },
    showAsterisk: {
      control: 'boolean',
      description: 'Figma: Show Asterisk — 필수 입력 표시 (asterisk *)',
    },
    helptext: {
      control: 'text',
      description: 'Figma: Helptext — 도움말 텍스트',
    },
    showHelptext: {
      control: 'boolean',
      description: 'Figma: Show Helptext — 도움말 표시 여부',
    },
    size: {
      control: 'select',
      options: Object.values(Size),
      description: 'Figma: Size — 그룹 크기 (Radio/Checkbox 크기에 영향)',
    },
    mode: {
      control: 'select',
      options: Object.values(Mode),
      description: 'SpacingMode: base/compact',
    },
    orientation: {
      control: 'select',
      options: ['horizontal', 'vertical'],
      description: 'Figma: Orientation — Option 배치 방향',
    },
    optionType: {
      control: 'select',
      options: ['radio', 'checkbox'],
      description: '스토리북 전용: Radio 또는 Checkbox 선택 (실제 API에는 없음)',
    },
  },
};

export default meta;

export const Default: StoryObj<OptionGroupStoryArgs> = {
  render: (args) => {
    const {
      label,
      showLabel = true,
      showAsterisk = false,
      helptext,
      showHelptext = true,
      size = 'md',
      mode = 'base',
      orientation = 'vertical',
      optionType = 'radio',
    } = args;

    // Radio 상태 관리
    const [selected, setSelected] = React.useState('option1');

    // Checkbox 상태 관리
    const [value1, setValue1] = React.useState<CheckboxValue>(CheckboxValue.CHECKED);
    const [value2, setValue2] = React.useState<CheckboxValue>(CheckboxValue.UNCHECKED);
    const [value3, setValue3] = React.useState<CheckboxValue>(CheckboxValue.UNCHECKED);

    // Storybook 전용: Figma 디자인 가이드에 따른 고정 너비
    const storybookWidth = orientation === 'vertical'
      ? { sm: '244px', md: '270px', lg: '289px' }[size]
      : { sm: '210px', md: '225px', lg: '243px' }[size];

    const containerStyle = { width: storybookWidth };

    return (
      <div style={containerStyle}>
        <OptionGroup
          label={label}
          showLabel={showLabel}
          showAsterisk={showAsterisk}
          helptext={helptext}
          showHelptext={showHelptext}
          size={size}
          mode={mode}
          orientation={orientation}
        >
        {optionType === 'radio' ? (
          <>
            <Option label="옵션 1">
              <Radio
                value={selected === 'option1' ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                onChange={() => setSelected('option1')}
                aria-label="option 1"
              />
            </Option>
            <Option label="옵션 2">
              <Radio
                value={selected === 'option2' ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                onChange={() => setSelected('option2')}
                aria-label="option 2"
              />
            </Option>
            <Option label="옵션 3">
              <Radio
                value={selected === 'option3' ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                onChange={() => setSelected('option3')}
                aria-label="option 3"
              />
            </Option>
          </>
        ) : (
          <>
            <Option label="옵션 1">
              <Checkbox
                value={value1}
                onChange={(e) => setValue1(e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED)}
                aria-label="checkbox 1"
              />
            </Option>
            <Option label="옵션 2">
              <Checkbox
                value={value2}
                onChange={(e) => setValue2(e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED)}
                aria-label="checkbox 2"
              />
            </Option>
            <Option label="옵션 3">
              <Checkbox
                value={value3}
                onChange={(e) => setValue3(e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED)}
                aria-label="checkbox 3"
              />
            </Option>
          </>
        )}
      </OptionGroup>
      </div>
    );
  },
  args: {
    label: '제목',
    showLabel: true,
    showAsterisk: false,
    helptext: '도움말 텍스트의 예시입니다. 줄이 길어지는 경우 줄바꿈되어 내려갑니다.',
    showHelptext: true,
    size: Size.MD,
    mode: Mode.BASE,
    orientation: 'vertical',
    optionType: 'radio',
  },
};

export const ManyOptions: StoryObj<OptionGroupStoryArgs> = {
  render: (args) => {
    const {
      label,
      showLabel = true,
      showAsterisk = false,
      helptext,
      showHelptext = true,
      size = 'md',
      mode = 'base',
      orientation = 'horizontal',
      optionType = 'checkbox',
    } = args;

    const optionLabels = Array.from({ length: 10 }, (_, i) => `옵션 ${i + 1}`);
    const [values, setValues] = React.useState<Record<string, CheckboxValue>>(
      Object.fromEntries(optionLabels.map(l => [l, CheckboxValue.UNCHECKED]))
    );
    const [selected, setSelected] = React.useState('옵션 1');

    const containerStyle = { width: '400px' };

    return (
      <div style={containerStyle}>
        <OptionGroup
          label={label}
          showLabel={showLabel}
          showAsterisk={showAsterisk}
          helptext={helptext}
          showHelptext={showHelptext}
          size={size}
          mode={mode}
          orientation={orientation}
        >
          {optionType === 'checkbox'
            ? optionLabels.map((optLabel) => (
                <Option key={optLabel} label={optLabel}>
                  <Checkbox
                    value={values[optLabel]}
                    onChange={(e) =>
                      setValues(prev => ({
                        ...prev,
                        [optLabel]: e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED,
                      }))
                    }
                    aria-label={optLabel}
                  />
                </Option>
              ))
            : optionLabels.map((optLabel) => (
                <Option key={optLabel} label={optLabel}>
                  <Radio
                    value={selected === optLabel ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                    onChange={() => setSelected(optLabel)}
                    aria-label={optLabel}
                  />
                </Option>
              ))
          }
        </OptionGroup>
      </div>
    );
  },
  args: {
    label: '옵션 10개 (줄바꿈 확인)',
    showLabel: true,
    showAsterisk: false,
    helptext: 'horizontal일 때 옵션이 많으면 자동으로 줄바꿈됩니다.',
    showHelptext: true,
    size: Size.MD,
    mode: Mode.BASE,
    orientation: 'horizontal',
    optionType: 'checkbox',
  },
};

export const LongLabel: StoryObj<OptionGroupStoryArgs> = {
  render: (args) => {
    const {
      label,
      showLabel = true,
      showAsterisk = false,
      helptext,
      showHelptext = true,
      size = 'md',
      mode = 'base',
      orientation = 'vertical',
      optionType = 'radio',
    } = args;

    const [selected, setSelected] = React.useState('option1');

    const [value1, setValue1] = React.useState<CheckboxValue>(CheckboxValue.CHECKED);
    const [value2, setValue2] = React.useState<CheckboxValue>(CheckboxValue.UNCHECKED);
    const [value3, setValue3] = React.useState<CheckboxValue>(CheckboxValue.UNCHECKED);

    const storybookWidth = orientation === 'vertical'
      ? { sm: '244px', md: '270px', lg: '289px' }[size]
      : { sm: '210px', md: '225px', lg: '243px' }[size];

    const containerStyle = { width: storybookWidth };

    return (
      <div style={containerStyle}>
        <OptionGroup
          label={label}
          showLabel={showLabel}
          showAsterisk={showAsterisk}
          helptext={helptext}
          showHelptext={showHelptext}
          size={size}
          mode={mode}
          orientation={orientation}
        >
        {optionType === 'radio' ? (
          <>
            <Option label="본 서비스는 회원가입 시 수집된 개인정보를 마케팅 및 광고 목적으로 활용할 수 있으며, 이에 동의하지 않을 경우 일부 프로모션 혜택 및 맞춤형 추천 서비스의 이용이 제한될 수 있습니다. 자세한 내용은 개인정보 처리방침을 참고하시기 바라며, 동의 여부는 마이페이지에서 언제든지 변경하실 수 있습니다. 관련 문의는 고객센터로 연락해 주시기 바랍니다.">
              <Radio
                value={selected === 'option1' ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                onChange={() => setSelected('option1')}
                aria-label="option 1"
              />
            </Option>
            <Option label="By selecting this option, you acknowledge and agree that your personal information may be collected, stored, and processed for the purposes of service improvement, marketing communications, and personalized content delivery in accordance with our privacy policy terms.">
              <Radio
                value={selected === 'option2' ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                onChange={() => setSelected('option2')}
                aria-label="option 2"
              />
            </Option>
            <Option label="옵션 3">
              <Radio
                value={selected === 'option3' ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                onChange={() => setSelected('option3')}
                aria-label="option 3"
              />
            </Option>
          </>
        ) : (
          <>
            <Option label="본 서비스는 회원가입 시 수집된 개인정보를 마케팅 및 광고 목적으로 활용할 수 있으며, 이에 동의하지 않을 경우 일부 프로모션 혜택 및 맞춤형 추천 서비스의 이용이 제한될 수 있습니다. 자세한 내용은 개인정보 처리방침을 참고하시기 바라며, 동의 여부는 마이페이지에서 언제든지 변경하실 수 있습니다. 관련 문의는 고객센터로 연락해 주시기 바랍니다.">
              <Checkbox
                value={value1}
                onChange={(e) => setValue1(e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED)}
                aria-label="checkbox 1"
              />
            </Option>
            <Option label="By selecting this option, you acknowledge and agree that your personal information may be collected, stored, and processed for the purposes of service improvement, marketing communications, and personalized content delivery in accordance with our privacy policy terms.">
              <Checkbox
                value={value2}
                onChange={(e) => setValue2(e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED)}
                aria-label="checkbox 2"
              />
            </Option>
            <Option label="옵션 3">
              <Checkbox
                value={value3}
                onChange={(e) => setValue3(e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED)}
                aria-label="checkbox 3"
              />
            </Option>
          </>
        )}
      </OptionGroup>
      </div>
    );
  },
  args: {
    label: '긴 레이블 (Long Label)',
    showLabel: true,
    showAsterisk: false,
    helptext: '옵션 레이블이 길어지는 경우 줄바꿈 처리를 확인합니다.',
    showHelptext: true,
    size: Size.MD,
    mode: Mode.BASE,
    orientation: 'vertical',
    optionType: 'radio',
  },
};
