# AI Service CI/CD 설정 가이드

> - `PROJECT_NUMBER` = `233376868812` (0단계에서 확인)
> - `OWNER/REPO` = 실제 GitHub 리포 (예: `adelab-inc/ds-bridge-ui`)

## 0. 프로젝트 번호 확인

```bash
gcloud projects describe "ds-runtime-hub" --format="value(projectNumber)"
```

## 1. Workload Identity Pool 생성

```bash
gcloud iam workload-identity-pools create "github-pool" --location="global" --display-name="GitHub Actions Pool" --project="ds-runtime-hub"
```

## 2. OIDC Provider 생성

```bash
gcloud iam workload-identity-pools providers create-oidc "github-provider" --location="global" --workload-identity-pool="github-pool" --display-name="GitHub Provider" --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" --attribute-condition="assertion.repository=='OWNER/REPO'" --issuer-uri="https://token.actions.githubusercontent.com" --project="ds-runtime-hub"
```

## 3. 서비스 계정 생성

기존 서비스 계정 확인:

```bash
gcloud iam service-accounts list --project="ds-runtime-hub"
```

없으면 새로 생성:

```bash
gcloud iam service-accounts create "github-actions" --display-name="GitHub Actions Deploy" --project="ds-runtime-hub"
```

## 4. 서비스 계정에 역할 부여

```bash
gcloud projects add-iam-policy-binding "ds-runtime-hub" --member="serviceAccount:github-actions@ds-runtime-hub.iam.gserviceaccount.com" --role="roles/run.admin"
```

```bash
gcloud projects add-iam-policy-binding "ds-runtime-hub" --member="serviceAccount:github-actions@ds-runtime-hub.iam.gserviceaccount.com" --role="roles/artifactregistry.writer"
```

```bash
gcloud projects add-iam-policy-binding "ds-runtime-hub" --member="serviceAccount:github-actions@ds-runtime-hub.iam.gserviceaccount.com" --role="roles/iam.serviceAccountUser"
```

## 5. WIF 바인딩

```bash
gcloud iam service-accounts add-iam-policy-binding "github-actions@ds-runtime-hub.iam.gserviceaccount.com" --role="roles/iam.workloadIdentityUser" --member="principalSet://iam.googleapis.com/projects/233376868812/locations/global/workloadIdentityPools/github-pool/attribute.repository/OWNER/REPO" --project="ds-runtime-hub"
```

## 6. WIF Provider 전체 경로 확인

```bash
gcloud iam workload-identity-pools providers describe "github-provider" --location="global" --workload-identity-pool="github-pool" --project="ds-runtime-hub" --format="value(name)"
```

## 7. GitHub Secrets 등록

GitHub 리포 → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

| Secret 이름 | 값 |
|---|---|
| `GCP_WORKLOAD_IDENTITY_PROVIDER` | 6단계에서 얻은 전체 경로 |
| `GCP_SERVICE_ACCOUNT` | `github-actions@ds-runtime-hub.iam.gserviceaccount.com` |
| `OPENAI_API_KEY` | `.env` 참조 |
| `ANTHROPIC_API_KEY` | `.env` 참조 |
| `GEMINI_API_KEY` | `.env` 참조 |
| `X_API_KEY` | `.env` 참조 |
| `CORS_ORIGINS` | `.env` 참조 |
| `SUPABASE_URL` | `.env` 참조 |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env` 참조 |

## 8. 검증

- `develop`에 `apps/ai-service/` 변경 머지 → Actions 탭에서 dev 배포 확인
- `main`에 머지 → prod 배포 확인
- 프론트엔드만 변경 머지 → 워크플로우 미트리거 확인
