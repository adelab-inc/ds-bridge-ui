import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';

export default tseslint.config(
  ...tseslint.configs.recommended,
  prettierConfig, // Prettier와 충돌하는 ESLint 규칙 비활성화
  {
    plugins: {
      import: importPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // Prettier를 ESLint 규칙으로 실행
      'prettier/prettier': 'error',

      // Import 정렬 및 관리 규칙
      'import/order': [
        'error',
        {
          groups: [
            'builtin', // Node.js 내장 모듈
            'external', // npm 패키지
            'internal', // 내부 alias 경로 (@/)
            'parent', // 상위 디렉토리 (..)
            'sibling', // 같은 디렉토리 (./)
            'index', // 현재 디렉토리 index
          ],
          'newlines-between': 'always',
          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],
      'import/newline-after-import': ['error', { count: 1 }],
      'import/no-duplicates': 'error',
    },
  },
  // React 규칙 - JSX/TSX 파일에만 적용
  {
    files: ['**/*.jsx', '**/*.tsx'],
    plugins: {
      react,
      'react-hooks': reactHooks,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
    rules: {
      // React 기본 규칙
      'react/jsx-uses-react': 'off', // React 17+ (new JSX transform)
      'react/react-in-jsx-scope': 'off', // React 17+ (new JSX transform)
      'react/prop-types': 'off', // TypeScript 사용 시 불필요
      'react/jsx-key': 'error', // 배열 렌더링 시 key 필수
      'react/no-children-prop': 'error', // children을 props로 전달 금지
      'react/no-danger-with-children': 'error', // dangerouslySetInnerHTML과 children 동시 사용 금지
      'react/no-deprecated': 'warn', // deprecated API 사용 경고
      'react/self-closing-comp': 'error', // 자식이 없는 컴포넌트는 self-closing

      // React Hooks 규칙
      'react-hooks/rules-of-hooks': 'error', // Hooks 규칙 준수
      'react-hooks/exhaustive-deps': 'warn', // useEffect 의존성 배열 검사
    },
  }
);
