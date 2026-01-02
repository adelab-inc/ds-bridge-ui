// vitest.setup.ts
// vitest 테스트 환경을 위한 전역 설정 파일

import '@testing-library/jest-dom';
import { expect, vi } from 'vitest';
import { toHaveNoViolations } from 'jest-axe';
import * as React from 'react';

// jest-axe의 접근성 검사 matcher를 vitest의 expect에 확장합니다.
expect.extend(toHaveNoViolations);

// LoadingSpinner 모킹 (Lottie는 테스트 환경에서 Canvas API가 필요하므로 모킹 필요)
vi.mock('./src/components/LoadingSpinner', () => ({
  LoadingSpinner: React.forwardRef<HTMLDivElement, any>(({ variant, size }, ref) => (
    React.createElement('div', {
      ref,
      'data-testid': 'loading-spinner',
      'data-variant': variant,
      style: { width: size, height: size },
    })
  )),
}));