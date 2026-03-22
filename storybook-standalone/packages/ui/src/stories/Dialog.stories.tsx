import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';

import { Dialog, DialogProps } from '../components/Dialog';
import { ModalStackProvider } from '../components/ModalStackProvider';
import { Button } from '../components/Button';
import { Checkbox } from '../components/Checkbox';
import { Option } from '../components/Option';

// Storybook 컨트롤용 확장 Props (Compound 컴포넌트의 props를 포함)
interface StoryArgs extends DialogProps {
  title?: string;
  subtitle?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
}

const meta: Meta<StoryArgs> = {
  title: 'UI/Dialog',
  component: Dialog,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: [
          '## Figma ↔ Code 인터페이스 매핑',
          '',
          'Dialog는 Compound 패턴 컴포넌트로, Figma의 여러 속성이 하위 컴포넌트(`Header`, `Body`, `Footer`)로 분산됩니다.',
          '',
          '### Dialog Root',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Size` | `size` | 동일 (sm/md/lg/xl) |',
          '| — | `mode` | Figma에 없는 코드 전용 속성. `SpacingModeProvider`로 일괄 제어 가능 |',
          '| `Show Scrollbar` | — | **반영 안 함**. `Dialog.Body`에 `overflow-y-auto` + size별 `max-h` 적용으로 브라우저가 자동 처리. Figma에서는 스크롤 상태 미리보기용 토글 |',
          '',
          '### Dialog/Body',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `contents` (text/field/tableset) | `children` | **반영 안 함**. Figma에서 컨텐츠 타입별 미리보기 전환용. 코드에서는 `children: ReactNode`로 모든 타입 수용. 디자이너 확인: 현재 7개 타입이지만 **확정 목록이 아니며 기획에 따라 계속 늘어날 수 있음** |',
          '| `Text` | `children` | `contents=text`일 때 표시되는 Figma 전용 속성. 코드에서는 children에 텍스트 직접 전달 |',
          '',
          '### Dialog/Footer',
          '',
          '| Figma Property | Code Prop | 차이점 및 이유 |',
          '|---|---|---|',
          '| `Size` | — | **반영 안 함**. Dialog Context에서 size 자동 상속. 개발자가 Footer에 별도 size를 지정하면 Dialog와 불일치 위험 |',
          '| `Show Control` | — | **반영 안 함**. `Dialog.Footer`에 children으로 자유 구성. boolean prop으로 제한하면 Compound 패턴의 유연성 상실 |',
          '| `Show 2action` | — | **반영 안 함**. `Dialog.Footer` 안에 Button을 원하는 만큼 배치. 고정 토글보다 조합 자유도가 높음 |',
          '| `Show 3action` | — | **반영 안 함**. `Dialog.Footer`에 Button 배치로 대체 |',
          '',
          '> **왜 Figma 토글을 코드 prop으로 따라가지 않는가?**',
          '>',
          '> Figma 컴포넌트에는 React의 `children` 개념이 없습니다. Footer에 "체크박스가 있는 버전"을 표현하려면 레이어를 미리 깔아놓고 boolean으로 켜고 끄는 수밖에 없습니다. 이것은 **디자인 의도가 아니라 Figma 도구의 합성(composition) 한계**입니다.',
          '>',
          '> React의 Compound 패턴(`Footer` + children)은 Figma 토글의 **상위 호환**입니다. 토글을 그대로 따라가면 도구의 한계를 코드에 수입하는 것이며, 디자이너가 Footer에 새로운 컨트롤(예: ToggleSwitch, RadioGroup)을 넣고 싶을 때 prop 확장이 필요해져 **디자인 시스템의 확장성이 오히려 떨어집니다.**',
          '>',
          '> 디자인 시스템 정렬의 목적은 Figma **속성 패널의 UI 구조**를 코드 API에 복제하는 것이 아니라, **렌더링 결과가 일치**하는 것입니다. Footer는 기본 `justify-end`이며, 좌우 분리가 필요하면 `className="justify-between"`으로 오버라이드합니다.',
          '',
          '> **디자이너 확인 (이희원)**: Body의 컨텐츠 종류와 Footer의 컨트롤/버튼 조합은 모두 **확정된 목록이 아닙니다.** 현재 Figma에 작업된 것은 현재 화면 기준 케이스를 커버한 것이며, 기획자분들의 화면기획이 추가되면 늘어날 수 있습니다. ERP 특성상 없다고 단정짓기 어려우므로, prop을 고정하지 않고 `children`으로 열어두는 것이 올바른 설계입니다.',
          '',
          '### Storybook Controls 참고',
          '',
          'Dialog는 Compound 패턴이므로 하위 컴포넌트의 props가 Storybook Controls에 자동 노출되지 않습니다. `StoryArgs`로 `title`, `subtitle`, `primaryLabel`, `secondaryLabel`을 확장하여 Controls 패널에서 주요 속성을 조작할 수 있게 했습니다.',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Figma: `Size`. Dialog 컨테이너의 너비와 최대 높이를 결정',
    },
    mode: {
      control: 'select',
      options: ['base', 'compact'],
      description: 'Figma에 없는 코드 전용 속성. `SpacingModeProvider`로 일괄 제어 가능, 개별 prop으로 오버라이드 가능',
    },
    title: {
      control: 'text',
      description: 'Storybook 전용 — `Dialog.Header`의 `title` prop에 전달',
    },
    subtitle: {
      control: 'text',
      description: 'Storybook 전용 — `Dialog.Header`의 `subtitle` prop에 전달 (선택사항)',
    },
    primaryLabel: {
      control: 'text',
      description: 'Storybook 전용 — `Dialog.Footer`의 Primary Button `label`에 전달',
    },
    secondaryLabel: {
      control: 'text',
      description: 'Storybook 전용 — `Dialog.Footer`의 Outline Button `label`에 전달',
    },
    x: { table: { disable: true } },
    y: { table: { disable: true } },
    onClose: { table: { disable: true } },
    open: { table: { disable: true } },
    children: { table: { disable: true } },
  },
};

export default meta;
type Story = StoryObj<StoryArgs>;

export const Default: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);
    const [dontShowAgain, setDontShowAgain] = useState<'unchecked' | 'checked'>('unchecked');

    return (
      <div>
        <Button label="Open Dialog" onClick={() => setIsOpen(true)} showStartIcon={false} showEndIcon={false} />
        <Dialog
          size={args.size}
          mode={args.mode}
          open={isOpen}
          onClose={() => setIsOpen(false)}
          x={args.x}
          y={args.y}
        >
          <Dialog.Header
            title={args.title || 'Dialog Title'}
            subtitle={args.subtitle}
          />
          <Dialog.Body>
            {args.children || 'Dialog content goes here. This is the body of the dialog.'}
          </Dialog.Body>
          <Dialog.Footer className="justify-between">
              <Option label="다시 보지 않기">
                <Checkbox
                  value={dontShowAgain}
                  onChange={() => setDontShowAgain(prev => prev === 'checked' ? 'unchecked' : 'checked')}
                />
              </Option>
              <div className="flex gap-component-gap-control-group">
                <Button
                  buttonType="outline"
                  label={args.secondaryLabel || '취소'}
                  onClick={() => {
                    console.log('Secondary clicked');
                    setIsOpen(false);
                  }}
                  showStartIcon={false}
                  showEndIcon={false}
                />
                <Button
                  buttonType="primary"
                  label={args.primaryLabel || '확인'}
                  onClick={() => {
                    console.log('Primary clicked, dontShowAgain:', dontShowAgain === 'checked');
                    setIsOpen(false);
                  }}
                  showStartIcon={false}
                  showEndIcon={false}
                />
              </div>
          </Dialog.Footer>
        </Dialog>
      </div>
    );
  },
  args: {
    size: 'md',
    mode: 'base',
    title: 'Dialog Title',
    subtitle: 'This is a subtitle description',
    children: 'Dialog content goes here. This is the body of the dialog.',
    primaryLabel: '확인',
    secondaryLabel: '취소',
  },
};

/**
 * 중첩 모달 테스트
 *
 * - ModalStackProvider로 감싸면 중첩 모달이 자동으로 관리됩니다.
 * - z-index가 자동으로 계산되어 새 모달이 항상 위에 표시됩니다.
 * - ESC 키와 Backdrop 클릭은 최상위 모달에만 반응합니다.
 * - Focus Trap도 최상위 모달에만 적용됩니다.
 */
export const NestedModals: Story = {
  render: (args) => {
    const [isFirstOpen, setIsFirstOpen] = useState(false);
    const [isSecondOpen, setIsSecondOpen] = useState(false);
    const [isThirdOpen, setIsThirdOpen] = useState(false);

    return (
      <ModalStackProvider>
        <div>
          <Button label="첫 번째 모달 열기" onClick={() => setIsFirstOpen(true)} showStartIcon={false} showEndIcon={false} />

          {/* 첫 번째 모달 */}
          <Dialog
            open={isFirstOpen}
            onClose={() => setIsFirstOpen(false)}
            size={args.size}
            mode={args.mode}
          >
            <Dialog.Header
              title="첫 번째 모달"
              subtitle="중첩 모달을 테스트해보세요"
            />
            <Dialog.Body>
              <div className="flex flex-col gap-4">
                <p>이 모달 위에 다른 모달을 열 수 있습니다.</p>
                <p className="text-text-tertiary text-body-sm-regular">
                  ESC 키를 누르면 최상위 모달만 닫힙니다.
                </p>
                <Button label="두 번째 모달 열기" onClick={() => setIsSecondOpen(true)} showStartIcon={false} showEndIcon={false} />
              </div>
            </Dialog.Body>
            <Dialog.Footer>
                <Button buttonType="primary" label="닫기" onClick={() => setIsFirstOpen(false)} showStartIcon={false} showEndIcon={false} />
            </Dialog.Footer>
          </Dialog>

          {/* 두 번째 모달 */}
          <Dialog
            open={isSecondOpen}
            onClose={() => setIsSecondOpen(false)}
            size={args.size}
            mode={args.mode}
          >
            <Dialog.Header
              title="두 번째 모달"
              subtitle="z-index가 자동으로 높아졌습니다"
            />
            <Dialog.Body>
              <div className="flex flex-col gap-4">
                <p>첫 번째 모달 위에 표시됩니다.</p>
                <p className="text-text-tertiary text-body-sm-regular">
                  Backdrop을 클릭하면 이 모달만 닫힙니다.
                </p>
                <Button label="세 번째 모달 열기" onClick={() => setIsThirdOpen(true)} showStartIcon={false} showEndIcon={false} />
              </div>
            </Dialog.Body>
            <Dialog.Footer>
                <Button buttonType="outline" label="취소" onClick={() => setIsSecondOpen(false)} showStartIcon={false} showEndIcon={false} />
                <Button buttonType="primary" label="닫기" onClick={() => setIsSecondOpen(false)} showStartIcon={false} showEndIcon={false} />
            </Dialog.Footer>
          </Dialog>

          {/* 세 번째 모달 */}
          <Dialog
            open={isThirdOpen}
            onClose={() => setIsThirdOpen(false)}
            size={args.size}
            mode={args.mode}
          >
            <Dialog.Header
              title="세 번째 모달"
              subtitle="최상위 모달입니다"
            />
            <Dialog.Body>
              <div className="flex flex-col gap-4">
                <p>3단계 중첩 모달입니다.</p>
                <p className="text-text-tertiary text-body-sm-regular">
                  Tab 키로 포커스 순환을 테스트해보세요.
                  이 모달 내부에서만 순환됩니다.
                </p>
              </div>
            </Dialog.Body>
            <Dialog.Footer>
                <Button buttonType="outline" label="이것만 닫기" onClick={() => setIsThirdOpen(false)} showStartIcon={false} showEndIcon={false} />
                <Button
                  buttonType="primary"
                  label="모두 닫기"
                  onClick={() => {
                    setIsThirdOpen(false);
                    setIsSecondOpen(false);
                    setIsFirstOpen(false);
                  }}
                  showStartIcon={false}
                  showEndIcon={false}
                />
            </Dialog.Footer>
          </Dialog>
        </div>
      </ModalStackProvider>
    );
  },
  args: {
    size: 'md',
    mode: 'base',
  },
  argTypes: {
    title: { table: { disable: true } },
    subtitle: { table: { disable: true } },
    primaryLabel: { table: { disable: true } },
    secondaryLabel: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        story: '`ModalStackProvider`로 감싸면 중첩 모달이 자동으로 관리됩니다. z-index, ESC 키, Focus Trap이 최상위 모달에만 적용됩니다.',
      },
    },
  },
};

/**
 * 스크롤 콘텐츠 테스트
 *
 * - Body 콘텐츠가 max-h를 초과할 때 overflow-y-auto로 스크롤이 생깁니다.
 * - Header/Footer는 스크롤 없이 고정되고, Body만 독립 스크롤됩니다.
 * - 좌우 패딩이 Header/Body/Footer 각각에 적용되어 스크롤바가 패딩을 침범하지 않습니다.
 */
export const ScrollContent: Story = {
  render: (args) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div>
        <Button label="Open Scroll Dialog" onClick={() => setIsOpen(true)} showStartIcon={false} showEndIcon={false} />
        <Dialog
          size={args.size}
          mode={args.mode}
          open={isOpen}
          onClose={() => setIsOpen(false)}
        >
          <Dialog.Header
            title="스크롤 콘텐츠 테스트"
            subtitle="Body 영역이 max-h를 초과하여 스크롤이 발생합니다"
          />
          <Dialog.Body>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 30 }, (_, i) => (
                <div key={i} className="rounded-lg border border-border-subtle p-4">
                  <p className="text-body-md-medium text-text-primary">항목 {i + 1}</p>
                  <p className="text-body-sm-regular text-text-secondary">
                    Header/Footer와 Body의 좌우 정렬이 일치하는지 확인하세요. 스크롤바가 우측 패딩을 침범하지 않아야 합니다.
                  </p>
                </div>
              ))}
            </div>
          </Dialog.Body>
          <Dialog.Footer>
            <Button
              buttonType="outline"
              label="취소"
              onClick={() => setIsOpen(false)}
              showStartIcon={false}
              showEndIcon={false}
            />
            <Button
              buttonType="primary"
              label="확인"
              onClick={() => setIsOpen(false)}
              showStartIcon={false}
              showEndIcon={false}
            />
          </Dialog.Footer>
        </Dialog>
      </div>
    );
  },
  args: {
    size: 'xl',
    mode: 'base',
  },
  argTypes: {
    title: { table: { disable: true } },
    subtitle: { table: { disable: true } },
    primaryLabel: { table: { disable: true } },
    secondaryLabel: { table: { disable: true } },
  },
  parameters: {
    docs: {
      description: {
        story: 'Body 콘텐츠가 max-h를 초과할 때 스크롤 동작을 확인합니다. Header/Footer와 Body의 좌우 패딩 정렬이 일치해야 합니다.',
      },
    },
  },
};
