import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { usePopup } from '../hooks/usePopup';
import { Button } from '../components/Button';

/**
 * `usePopup` 훅은 팝업 창을 열고 부모-자식 창 간 통신을 관리합니다.
 */

// 기본 사용법 데모
function BasicUsageDemo() {
  const { open, close } = usePopup();
  const [status, setStatus] = useState<'closed' | 'open'>('closed');

  const handleOpen = () => {
    open({
      url: 'about:blank',
      name: 'demoPopup',
      options: { width: 500, height: 400, left: 'center', top: 'center' },
      onClose: () => setStatus('closed'),
    });
    setStatus('open');
  };

  return (
    <div className="p-5">
      <h3 className="text-lg font-semibold mb-4">기본 사용법</h3>

      <div className="mb-4 flex gap-2">
        <Button onClick={handleOpen} disabled={status === 'open'}>
          팝업 열기
        </Button>
        <Button variant="outline" onClick={close} disabled={status === 'closed'}>
          팝업 닫기
        </Button>
      </div>

      <div className="p-4 bg-gray-100 rounded-lg mb-4">
        <div className="flex items-center gap-2">
          <strong>상태:</strong>
          <span className={`px-2 py-1 rounded text-sm ${
            status === 'open' ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
          }`}>
            {status === 'open' ? '열림' : '닫힘'}
          </span>
        </div>
      </div>

      <div className="p-4 bg-blue-50 rounded-lg text-sm">
        <p className="font-semibold mb-2">코드 예시:</p>
        <pre className="bg-gray-800 text-gray-100 p-3 rounded text-xs overflow-auto">
{`const { open, close } = usePopup();

// 팝업 열기
open({
  url: '/popup/search',
  name: 'searchPopup',
  options: { width: 500, height: 400 },
  onComplete: (data) => console.log(data),
  onClose: () => console.log('닫힘'),
});

// 팝업 닫기
close();`}
        </pre>
      </div>
    </div>
  );
}

// Close 메서드 테스트 데모
function CloseTestDemo() {
  const { open, close } = usePopup();
  const [status, setStatus] = useState<'closed' | 'open'>('closed');
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleOpen = () => {
    addLog('open() 호출');
    open({
      url: 'about:blank',
      name: 'closeTestPopup',
      options: { width: 400, height: 300, left: 'center', top: 'center' },
      onClose: () => {
        setStatus('closed');
        addLog('onClose 콜백 실행됨');
      },
    });
    setStatus('open');
    addLog('팝업 열림');
  };

  const handleClose = () => {
    addLog('close() 호출');
    close();
  };

  const clearLog = () => setLog([]);

  return (
    <div className="p-5">
      <h3 className="text-lg font-semibold mb-4">Close 메서드 테스트</h3>

      <div className="mb-4 flex gap-2">
        <Button onClick={handleOpen} disabled={status === 'open'}>
          팝업 열기
        </Button>
        <Button
          variant="destructive"
          onClick={handleClose}
          disabled={status === 'closed'}
        >
          팝업 닫기 (close)
        </Button>
        <Button variant="outline" onClick={clearLog}>
          로그 초기화
        </Button>
      </div>

      <div className="p-4 bg-gray-100 rounded-lg mb-4">
        <div className="flex items-center gap-2 mb-2">
          <strong>팝업 상태:</strong>
          <span className={`px-2 py-1 rounded text-sm ${
            status === 'open' ? 'bg-green-500 text-white' : 'bg-gray-400 text-white'
          }`}>
            {status === 'open' ? '열림' : '닫힘'}
          </span>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-lg mb-4 max-h-40 overflow-auto">
        <strong className="block mb-2">실행 로그:</strong>
        {log.length === 0 ? (
          <p className="text-gray-500 text-sm">로그가 없습니다.</p>
        ) : (
          <ul className="space-y-1">
            {log.map((entry, i) => (
              <li key={i} className="font-mono text-xs">{entry}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-4 bg-blue-50 rounded-lg text-sm">
        <p className="font-semibold mb-2">테스트 순서:</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>팝업 열기 → 새 창 열림</li>
          <li>팝업 닫기 버튼 클릭 → close() 호출</li>
          <li>onClose 콜백 실행 확인</li>
        </ol>
      </div>
    </div>
  );
}

// Storybook 메타 설정
const meta: Meta = {
  title: 'Hooks/usePopup',
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component: `
\`usePopup\` 훅은 브라우저 팝업 창을 관리합니다.

### 설치
\`\`\`tsx
import { usePopup } from '@aplus/ui/hooks';
\`\`\`

### API
| 메서드 | 설명 |
|--------|------|
| \`open(config)\` | 팝업을 엽니다 |
| \`sendData(data)\` | 열린 팝업에 데이터를 전송합니다 |
| \`close()\` | 열린 팝업을 닫습니다 |

### 기본 사용법
\`\`\`tsx
const { open, close } = usePopup();

// 팝업 열기
open({
  url: '/popup/search',
  name: 'searchPopup',
  onComplete: (data) => console.log('결과:', data),
  onClose: () => console.log('닫힘'),
});

// 팝업 닫기
close();
\`\`\`

📄 상세 문서: \`packages/ui/docs/hooks/usePopup.md\`
        `,
      },
    },
  },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  name: '기본 사용법',
  render: () => <BasicUsageDemo />,
};

export const CloseTest: Story = {
  name: 'Close 테스트',
  render: () => <CloseTestDemo />,
};
