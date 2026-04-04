import * as React from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { FormGrid, FormGridCell } from '../layout/FormGrid';
import { LabelValue } from '../components/LabelValue';
import { Field } from '../components/Field';
import { OptionGroup } from '../components/OptionGroup';
import { Option } from '../components/Option';
import { Radio } from '../components/Radio';
import { Checkbox } from '../components/Checkbox';
import { SpacingModeProvider } from '../components/SpacingModeProvider';
import { CheckboxValue, RadioValue } from '../types';

/**
 * FieldGroup 내부 Field는 label·helptext 없이 사용하므로
 * show* discriminated union을 우회하여 실제 사용 props만 허용하는 타입으로 캐스팅
 */
const SimpleField = Field as unknown as React.ComponentType<{
  placeholder?: string;
  className?: string;
  size?: 'md' | 'sm';
  showLabel?: boolean;
  label?: string;
  showHelptext?: boolean;
  showPrefix?: boolean;
  showStartIcon?: boolean;
  showEndIcon?: boolean;
}>;

const SimpleLabelValue = LabelValue as unknown as React.ComponentType<{
  text?: string;
  showLabel?: boolean;
  label?: string;
  showHelptext?: boolean;
  showPrefix?: boolean;
  showStartIcon?: boolean;
  showEndIcon?: boolean;
  size?: 'md' | 'sm';
  className?: string;
}>;

const meta: Meta<typeof FormGrid> = {
  title: 'Layout/FormGrid',
  component: FormGrid,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[800px]">
        <Story />
      </div>
    ),
  ],
  parameters: {
    docs: {
      description: {
        component: [
          '## FormGrid - 폼 그리드 레이아웃',
          '',
          'FormGrid는 **폼 필드를 N단(columns) 그리드로 배치하기 위한 레이아웃 컨테이너**입니다.',
          '',
          '- `FormGrid`: CSS Grid 컨테이너 (columns, gap 토큰 적용)',
          '- `FormGridCell`: 개별 셀 (`colSpan`으로 열 병합 가능)',
          '',
          '### 사용 토큰',
          '',
          '| 용도 | 토큰명 | base | compact |',
          '|---|---|---|---|',
          '| column-gap | `component-gap-field-group-x` | 24px | 20px |',
          '| row-gap | `component-gap-field-group-y` | 16px | 12px |',
          '| title → grid 간격 | `layout-stack-md` | 12px | 12px |',
          '',
          '### 사용 예시',
          '',
          '```tsx',
          '<FormGrid columns={3} title="기본 정보">',
          '  <FormGridCell><LabelValue label="이름" /></FormGridCell>',
          '  <FormGridCell colSpan={2}><LabelValue label="주소" /></FormGridCell>',
          '</FormGrid>',
          '```',
        ].join('\n'),
      },
    },
    controls: { include: ['columns', 'title'] },
  },
  argTypes: {
    columns: {
      control: { type: 'select' },
      options: [1, 2, 3, 4],
      description: '그리드 열 수',
    },
    title: {
      control: { type: 'text' },
      description: '그리드 상단 타이틀 (optional)',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormGrid>;

// ─── 기본 2단 그리드 ───
export const Default: Story = {
  name: '기본 - 2단 그리드',
  args: {
    columns: 2,
  },
  render: (args) => (
    <FormGrid {...args}>
      <FormGridCell>
        <SimpleLabelValue showLabel label="이름" text="홍길동" size="md" />
      </FormGridCell>
      <FormGridCell>
        <SimpleLabelValue showLabel label="사번" text="A12345" size="md" />
      </FormGridCell>
      <FormGridCell>
        <SimpleLabelValue showLabel label="부서" text="개발팀" size="md" />
      </FormGridCell>
      <FormGridCell>
        <SimpleLabelValue showLabel label="직급" text="과장" size="md" />
      </FormGridCell>
    </FormGrid>
  ),
};

// ─── 3단 그리드 + colSpan ───
export const ThreeColumnsWithSpan: Story = {
  name: '3단 그리드 + colSpan',
  args: {
    columns: 3,
  },
  render: (args) => (
    <FormGrid {...args}>
      <FormGridCell>
        <SimpleLabelValue showLabel label="이름" text="홍길동" size="md" />
      </FormGridCell>
      <FormGridCell>
        <SimpleLabelValue showLabel label="사번" text="A12345" size="md" />
      </FormGridCell>
      <FormGridCell>
        <SimpleLabelValue showLabel label="부서" text="개발팀" size="md" />
      </FormGridCell>
      <FormGridCell colSpan={2}>
        <SimpleLabelValue showLabel label="주소" text="서울특별시 강남구 테헤란로 123 45층" size="md" />
      </FormGridCell>
      <FormGridCell>
        <SimpleLabelValue showLabel label="우편번호" text="06234" size="md" />
      </FormGridCell>
    </FormGrid>
  ),
};

// ─── 타이틀 포함 ───
export const WithTitle: Story = {
  name: '타이틀 포함',
  args: {
    columns: 3,
    title: '기본 정보',
  },
  render: (args) => (
    <FormGrid {...args}>
      <FormGridCell>
        <SimpleLabelValue showLabel label="이름" text="홍길동" size="md" />
      </FormGridCell>
      <FormGridCell>
        <SimpleLabelValue showLabel label="사번" text="A12345" size="md" />
      </FormGridCell>
      <FormGridCell>
        <SimpleLabelValue showLabel label="부서" text="개발팀" size="md" />
      </FormGridCell>
      <FormGridCell>
        <SimpleLabelValue showLabel label="직급" text="과장" size="md" />
      </FormGridCell>
      <FormGridCell colSpan={2}>
        <SimpleLabelValue showLabel label="이메일" text="hong@example.com" size="md" />
      </FormGridCell>
    </FormGrid>
  ),
};

// ─── 입력 폼 (Field 조합) ───
export const WithFields: Story = {
  name: '입력 폼 - Field 조합',
  args: {
    columns: 3,
    title: '직원 등록',
  },
  render: (args) => (
    <FormGrid {...args}>
      <FormGridCell>
        <SimpleField showLabel label="이름" placeholder="이름 입력" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
      </FormGridCell>
      <FormGridCell>
        <SimpleField showLabel label="사번" placeholder="사번 입력" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
      </FormGridCell>
      <FormGridCell>
        <SimpleField showLabel label="부서" placeholder="부서 입력" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
      </FormGridCell>
      <FormGridCell colSpan={2}>
        <SimpleField showLabel label="주소" placeholder="주소를 입력하세요" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
      </FormGridCell>
      <FormGridCell>
        <SimpleField showLabel label="우편번호" placeholder="00000" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
      </FormGridCell>
    </FormGrid>
  ),
};

// ─── Compact 모드 비교 ───
export const CompactMode: Story = {
  name: 'Compact 모드 비교',
  render: () => (
    <div className="flex flex-col gap-10">
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-500">Base Mode</p>
        <SpacingModeProvider mode="base">
          <FormGrid columns={3} title="기본 정보">
            <FormGridCell>
              <SimpleLabelValue showLabel label="이름" text="홍길동" size="md" />
            </FormGridCell>
            <FormGridCell>
              <SimpleLabelValue showLabel label="사번" text="A12345" size="md" />
            </FormGridCell>
            <FormGridCell>
              <SimpleLabelValue showLabel label="부서" text="개발팀" size="md" />
            </FormGridCell>
            <FormGridCell>
              <SimpleLabelValue showLabel label="직급" text="과장" size="md" />
            </FormGridCell>
            <FormGridCell colSpan={2}>
              <SimpleLabelValue showLabel label="이메일" text="hong@example.com" size="md" />
            </FormGridCell>
          </FormGrid>
        </SpacingModeProvider>
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-gray-500">Compact Mode</p>
        <SpacingModeProvider mode="compact">
          <FormGrid columns={3} title="기본 정보">
            <FormGridCell>
              <SimpleLabelValue showLabel label="이름" text="홍길동" size="md" />
            </FormGridCell>
            <FormGridCell>
              <SimpleLabelValue showLabel label="사번" text="A12345" size="md" />
            </FormGridCell>
            <FormGridCell>
              <SimpleLabelValue showLabel label="부서" text="개발팀" size="md" />
            </FormGridCell>
            <FormGridCell>
              <SimpleLabelValue showLabel label="직급" text="과장" size="md" />
            </FormGridCell>
            <FormGridCell colSpan={2}>
              <SimpleLabelValue showLabel label="이메일" text="hong@example.com" size="md" />
            </FormGridCell>
          </FormGrid>
        </SpacingModeProvider>
      </div>
    </div>
  ),
};

// ─── Columns 비교 (1~4단) ───
export const ColumnsComparison: Story = {
  name: 'Columns 비교 (1~4단)',
  render: () => (
    <div className="flex flex-col gap-10">
      {([1, 2, 3, 4] as const).map((col) => (
        <div key={col}>
          <p className="mb-2 text-sm font-semibold text-gray-500">{col}단 그리드</p>
          <FormGrid columns={col}>
            {Array.from({ length: col * 2 }, (_, i) => (
              <FormGridCell key={i}>
                <SimpleField showLabel label={`필드 ${i + 1}`} placeholder={`값 ${i + 1}`} size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
              </FormGridCell>
            ))}
          </FormGrid>
        </div>
      ))}
    </div>
  ),
};

// ─── OptionGroup Wrap (옵션이 많을 때 줄바꿈) ───
export const OptionGroupWrap: Story = {
  name: 'OptionGroup - 옵션 많을 때 Wrap',
  render: () => {
    const [selected, setSelected] = React.useState('opt1');
    const optionLabels = Array.from({ length: 8 }, (_, i) => `옵션 ${i + 1}`);

    return (
      <FormGrid columns={3} title="옵션 그룹 Wrap 확인">
        <FormGridCell colSpan={2}>
          <OptionGroup label="카테고리 선택" showLabel orientation="horizontal" size="md">
            {optionLabels.map((label) => (
              <Option key={label} label={label}>
                <Radio
                  value={selected === label ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                  onChange={() => setSelected(label)}
                  aria-label={label}
                />
              </Option>
            ))}
          </OptionGroup>
        </FormGridCell>
        <FormGridCell>
          <SimpleField showLabel label="비고" placeholder="비고 입력" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
        </FormGridCell>
      </FormGrid>
    );
  },
};

// ─── Field + OptionGroup 상단 정렬 ───
export const FieldWithOptionGroupAlignment: Story = {
  name: 'Field + OptionGroup 상단 정렬',
  render: () => {
    const [values, setValues] = React.useState<Record<string, CheckboxValue>>({
      '동의 1': CheckboxValue.CHECKED,
      '동의 2': CheckboxValue.UNCHECKED,
      '동의 3': CheckboxValue.UNCHECKED,
    });

    return (
      <div className="flex flex-col gap-10">
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-500">OptionGroup 라벨 있음</p>
          <FormGrid columns={3} title="필드 + 옵션 그룹">
            <FormGridCell>
              <SimpleField showLabel label="이름" placeholder="이름 입력" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
            </FormGridCell>
            <FormGridCell>
              <SimpleField showLabel label="부서" placeholder="부서 입력" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
            </FormGridCell>
            <FormGridCell>
              <OptionGroup label="동의 항목" showLabel orientation="horizontal" size="md">
                {Object.keys(values).map((key) => (
                  <Option key={key} label={key}>
                    <Checkbox
                      value={values[key]}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [key]: e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED,
                        }))
                      }
                      aria-label={key}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
          </FormGrid>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-500">OptionGroup 라벨 없음 (showLabel=false)</p>
          <FormGrid columns={3} title="필드 + 옵션 그룹 (무라벨)">
            <FormGridCell>
              <SimpleField showLabel label="이름" placeholder="이름 입력" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
            </FormGridCell>
            <FormGridCell>
              <SimpleField showLabel label="부서" placeholder="부서 입력" size="md" showHelptext={false} showPrefix={false} showStartIcon={false} showEndIcon={false} />
            </FormGridCell>
            <FormGridCell>
              <OptionGroup label="동의 항목" showLabel={false} reserveLabelSpace orientation="horizontal" size="md">
                {Object.keys(values).map((key) => (
                  <Option key={key} label={key}>
                    <Checkbox
                      value={values[key]}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [key]: e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED,
                        }))
                      }
                      aria-label={key}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
          </FormGrid>
        </div>
      </div>
    );
  },
};

// ─── OptionGroup Wrap + OptionGroup 상단 정렬 ───
export const OptionGroupPairAlignment: Story = {
  name: 'OptionGroup Wrap + OptionGroup 상단 정렬',
  render: () => {
    const [selected, setSelected] = React.useState('카테고리 1');
    const [values, setValues] = React.useState<Record<string, CheckboxValue>>({
      '항목 A': CheckboxValue.CHECKED,
      '항목 B': CheckboxValue.UNCHECKED,
      '항목 C': CheckboxValue.UNCHECKED,
    });

    const manyOptions = Array.from({ length: 10 }, (_, i) => `카테고리 ${i + 1}`);

    return (
      <div className="flex flex-col gap-10">
        <div>
          <p className="mb-2 text-sm font-semibold text-gray-500">colSpan=2 Wrap OptionGroup + 1칸 OptionGroup</p>
          <FormGrid columns={3} title="옵션 그룹 나란히 배치">
            <FormGridCell colSpan={2}>
              <OptionGroup label="카테고리 (많은 옵션 - Wrap)" showLabel orientation="horizontal" size="md">
                {manyOptions.map((label) => (
                  <Option key={label} label={label}>
                    <Radio
                      value={selected === label ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                      onChange={() => setSelected(label)}
                      aria-label={label}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
            <FormGridCell>
              <OptionGroup label="확인 항목" showLabel orientation="horizontal" size="md">
                {Object.keys(values).map((key) => (
                  <Option key={key} label={key}>
                    <Checkbox
                      value={values[key]}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [key]: e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED,
                        }))
                      }
                      aria-label={key}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
          </FormGrid>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-500">왼쪽 라벨 + 오른쪽 무라벨</p>
          <FormGrid columns={3} title="카테고리(라벨) + 확인(무라벨)">
            <FormGridCell colSpan={2}>
              <OptionGroup label="카테고리 (많은 옵션 - Wrap)" showLabel orientation="horizontal" size="md">
                {manyOptions.map((label) => (
                  <Option key={label} label={label}>
                    <Radio
                      value={selected === label ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                      onChange={() => setSelected(label)}
                      aria-label={label}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
            <FormGridCell>
              <OptionGroup label="확인 항목" showLabel={false} reserveLabelSpace orientation="horizontal" size="md">
                {Object.keys(values).map((key) => (
                  <Option key={key} label={key}>
                    <Checkbox
                      value={values[key]}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [key]: e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED,
                        }))
                      }
                      aria-label={key}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
          </FormGrid>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-500">왼쪽 무라벨 + 오른쪽 라벨</p>
          <FormGrid columns={3} title="카테고리(무라벨) + 확인(라벨)">
            <FormGridCell colSpan={2}>
              <OptionGroup label="카테고리" showLabel={false} reserveLabelSpace orientation="horizontal" size="md">
                {manyOptions.map((label) => (
                  <Option key={label} label={label}>
                    <Radio
                      value={selected === label ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                      onChange={() => setSelected(label)}
                      aria-label={label}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
            <FormGridCell>
              <OptionGroup label="확인 항목" showLabel orientation="horizontal" size="md">
                {Object.keys(values).map((key) => (
                  <Option key={key} label={key}>
                    <Checkbox
                      value={values[key]}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [key]: e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED,
                        }))
                      }
                      aria-label={key}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
          </FormGrid>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-gray-500">양쪽 모두 무라벨</p>
          <FormGrid columns={3} title="카테고리(무라벨) + 확인(무라벨)">
            <FormGridCell colSpan={2}>
              <OptionGroup label="카테고리" showLabel={false} orientation="horizontal" size="md">
                {manyOptions.map((label) => (
                  <Option key={label} label={label}>
                    <Radio
                      value={selected === label ? RadioValue.CHECKED : RadioValue.UNCHECKED}
                      onChange={() => setSelected(label)}
                      aria-label={label}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
            <FormGridCell>
              <OptionGroup label="확인 항목" showLabel={false} orientation="horizontal" size="md">
                {Object.keys(values).map((key) => (
                  <Option key={key} label={key}>
                    <Checkbox
                      value={values[key]}
                      onChange={(e) =>
                        setValues((prev) => ({
                          ...prev,
                          [key]: e.target.checked ? CheckboxValue.CHECKED : CheckboxValue.UNCHECKED,
                        }))
                      }
                      aria-label={key}
                    />
                  </Option>
                ))}
              </OptionGroup>
            </FormGridCell>
          </FormGrid>
        </div>
      </div>
    );
  },
};
