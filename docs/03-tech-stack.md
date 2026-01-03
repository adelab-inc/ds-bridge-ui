# 03. 기술 스택

> **대상 독자**: 개발자 (필수), PM/디자이너 (참고)
> **기술 수준**: 중급

## TL;DR (핵심 요약)

| 영역 | 선택 기술 | 한줄 설명 |
|------|----------|----------|
| 모노레포 | Turborepo + pnpm | 빠른 빌드, 효율적 패키지 관리 |
| FE 프레임워크 | Next.js 15 | React 기반 풀스택 프레임워크 |
| 스타일링 | Tailwind CSS | 유틸리티 기반 CSS |
| UI 컴포넌트 | Shadcn/ui | 복사해서 쓰는 컴포넌트 라이브러리 |
| 코드 에디터 | Monaco Editor | VS Code와 동일한 에디터 |
| 코드 프리뷰 | Sandpack | 브라우저 내 코드 실행 환경 |
| AI 통합 | Vercel AI SDK | AI 스트리밍 응답 처리 |

---

## 기술 선택 원칙

1. **검증된 기술**: 커뮤니티가 크고 문서화가 잘 된 기술 우선
2. **개발 생산성**: 빠른 개발과 디버깅이 가능한 도구
3. **AI 친화적**: AI가 생성하기 쉬운 코드 패턴 지원
4. **확장성**: 향후 기능 추가가 용이한 구조

---

## 빌드 & 패키지 관리

### Turborepo

**무엇인가요?**
여러 프로젝트를 하나의 저장소에서 효율적으로 관리하는 도구입니다.

**왜 선택했나요?**
| 장점 | 설명 |
|------|------|
| 캐싱 | 변경되지 않은 부분은 다시 빌드하지 않음 |
| 병렬 실행 | 여러 작업을 동시에 실행 |
| Vercel 통합 | 배포 플랫폼과 긴밀한 연동 |

**대안 비교**:
| 도구 | 장점 | 단점 |
|------|------|------|
| **Turborepo** ✓ | 빠름, 설정 간단 | 기능이 Nx보다 적음 |
| Nx | 기능 풍부 | 학습 곡선 높음 |
| Lerna | 역사가 김 | 성능이 느림 |

### pnpm

**무엇인가요?**
npm, yarn과 같은 패키지 매니저입니다.

**왜 선택했나요?**
| 장점 | 설명 |
|------|------|
| 디스크 절약 | 패키지를 한 번만 저장하고 링크로 공유 |
| 빠른 설치 | npm 대비 2배 이상 빠름 |
| 엄격한 의존성 | 명시하지 않은 패키지 사용 방지 |

---

## 프론트엔드 프레임워크

### Next.js 15

**무엇인가요?**
React 기반의 풀스택 웹 프레임워크입니다.

**왜 선택했나요?**
| 기능 | 우리 프로젝트에서의 활용 |
|------|------------------------|
| App Router | 직관적인 파일 기반 라우팅 |
| Server Components | 초기 로딩 성능 개선 |
| API Routes | 간단한 백엔드 API 구현 (Mock 서버) |
| Streaming | AI 응답 실시간 표시 |

**버전 선택 이유**:
- Next.js 15 + React 19 조합으로 최신 기능 활용
- Streaming UI가 AI 응답에 최적화

### React 19

**새로운 기능 활용**:
| 기능 | 설명 |
|------|------|
| Server Components | 서버에서 렌더링되는 컴포넌트 |
| Actions | 폼 제출 간소화 |
| use() Hook | 비동기 데이터 처리 개선 |

---

## 스타일링

### Tailwind CSS

**무엇인가요?**
HTML에 직접 스타일을 작성하는 유틸리티 CSS 프레임워크입니다.

**왜 선택했나요?**

**1. AI 코드 생성에 최적화**
```jsx
// AI가 생성하기 쉬운 형태
<button className="bg-blue-500 text-white px-4 py-2 rounded">
  클릭
</button>
```

**2. 디자인 시스템 통합 용이**
```js
// tailwind.config.js에서 브랜드 색상 정의
colors: {
  brand: {
    primary: '#3B82F6',
    secondary: '#10B981',
  }
}
```

**3. 빠른 프로토타이핑**
- CSS 파일 왔다갔다 없이 컴포넌트에서 바로 스타일링
- 디자이너가 정의한 spacing, color 시스템 그대로 적용

### Shadcn/ui

**무엇인가요?**
"설치"하는 게 아니라 "복사"해서 쓰는 UI 컴포넌트 모음입니다.

**왜 선택했나요?**
| 장점 | 설명 |
|------|------|
| 커스터마이징 | 코드를 직접 소유하므로 자유롭게 수정 가능 |
| 접근성 | Radix UI 기반으로 접근성 표준 준수 |
| 일관성 | 디자인 토큰으로 일관된 스타일 유지 |
| AI 친화적 | AI가 컴포넌트 구조를 학습하기 쉬움 |

**디자이너 참고**:
- 기본 컴포넌트가 제공되므로 디자인 시스템 구축 시간 단축
- 색상, 간격, 타이포그래피는 커스터마이징 가능

---

## 코드 에디터

### Monaco Editor

**무엇인가요?**
VS Code에서 사용하는 것과 동일한 코드 에디터입니다.

**왜 선택했나요?**
| 기능 | 설명 |
|------|------|
| 문법 하이라이팅 | 코드 색상 구분 |
| 자동 완성 | IntelliSense 지원 |
| 에러 표시 | 빨간 밑줄로 오류 표시 |
| 다중 파일 | 탭으로 여러 파일 관리 |

**대안 비교**:
| 도구 | 장점 | 단점 |
|------|------|------|
| **Monaco** ✓ | 기능 풍부, VS Code 동일 | 번들 크기 큼 |
| CodeMirror | 가벼움 | 기능이 적음 |
| Ace Editor | 역사가 김 | 업데이트 느림 |

---

## 코드 프리뷰

### Sandpack

**무엇인가요?**
CodeSandbox 팀이 만든 브라우저 내 코드 실행 환경입니다.

**왜 선택했나요?**
| 장점 | 설명 |
|------|------|
| React 최적화 | React 코드 실행에 특화 |
| 빠른 업데이트 | 코드 수정 시 즉시 반영 |
| 안전한 샌드박스 | 격리된 환경에서 실행 |
| npm 패키지 지원 | 외부 라이브러리 사용 가능 |

**대안 비교**:
| 도구 | 장점 | 단점 |
|------|------|------|
| **Sandpack** ✓ | 가벼움, React 특화 | 커스텀 빌드 제한 |
| WebContainer | Node.js 실행 가능 | 복잡함, 무거움 |
| iframe + Blob | 단순함 | 보안 위험, 느림 |

---

## AI 통합

### Vercel AI SDK

**무엇인가요?**
AI 모델의 스트리밍 응답을 프론트엔드에서 쉽게 처리하는 라이브러리입니다.

**왜 선택했나요?**
```typescript
// 스트리밍 응답을 간단하게 처리
import { useChat } from 'ai/react';

function CodeGenerator() {
  const { messages, input, handleSubmit } = useChat({
    api: '/api/generate'
  });

  return (
    <form onSubmit={handleSubmit}>
      <input value={input} />
      {/* 코드가 실시간으로 나타남 */}
      <pre>{messages[messages.length - 1]?.content}</pre>
    </form>
  );
}
```

**지원 AI 모델**:
- Anthropic Claude
- OpenAI GPT-4
- Google Gemini
- 기타 OpenAI 호환 API

---

## AI 서버 (AI 개발자 영역)

### 기술 선택 자유도

AI 개발자는 다음 중 자유롭게 선택할 수 있습니다:

| 기술 | 장점 | 적합한 경우 |
|------|------|------------|
| **Python + FastAPI** | LangChain 생태계, 빠른 개발 | LLM 오케스트레이션 필요 시 |
| **Python + LangChain** | 프롬프트 체이닝, 에이전트 | 복잡한 AI 파이프라인 |
| **Node.js** | FE와 동일 언어 | 단순한 API 래핑 |
| **Go** | 높은 성능 | 대규모 트래픽 처리 |

### 권장 구성 (Python)

```
ai-service/
├── src/
│   ├── api/
│   │   └── routes.py       # FastAPI 라우트
│   ├── prompts/
│   │   └── templates.py    # 프롬프트 템플릿
│   ├── generators/
│   │   └── code_gen.py     # 코드 생성 로직
│   └── validators/
│       └── syntax.py       # 코드 검증
├── pyproject.toml
└── Dockerfile
```

---

## 버전 요약

| 기술 | 버전 | 비고 |
|------|------|------|
| Node.js | 20.x LTS | 필수 |
| pnpm | 8.x | 필수 |
| Next.js | 15.x | 필수 |
| React | 19.x | 필수 |
| TypeScript | 5.x | 필수 |
| Tailwind CSS | 3.x | 필수 |
| Monaco Editor | 최신 | 필수 |
| Sandpack | 최신 | 필수 |

---

## 다음 문서

- [04. API 계약](./04-api-contract.md) - FE ↔ AI 인터페이스 상세
- [06. 디렉토리 구조](./06-directory-structure.md) - 코드베이스 구조
