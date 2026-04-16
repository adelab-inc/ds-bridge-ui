# Validator Regression Fixtures

code_validator 회귀 기준 세트.
- `*.tsx`: 입력 소스 (실제 생성 코드 축약본)
- `expected/*.json`: `{"passed": bool, "categories": [str, ...]}` — 상세 메시지는 검사 대상 아님

출처: `apps/ai-service/test-batch-output/`에서 대표 케이스를 축약·커밋.
