# EasyStart TRD (Technical Requirements Document)

## 1. 문서 목적
EasyStart를 안정적으로 개발·배포·운영하기 위한 기술 요구사항, 아키텍처, 데이터/인터페이스, 품질 기준을 정의한다.

## 2. 기술 스택
- **Runtime**: Node.js 20+
- **Web Framework**: Express 5
- **View Engine**: EJS
- **AI 연동**:
  - `@github/copilot-sdk` (우선 시도)
  - GitHub Models API (`gpt-4o-mini`, OpenAI SDK)
  - 실패 시 휴리스틱 분석 fallback
- **보조 라이브러리**: `dotenv`, `uuid`
- **배포 인프라**: Azure App Service + Application Insights (`azure.yaml`, `infra/main.bicep`)

## 3. 시스템 아키텍처
### 3.1 구성 요소
1. **Presentation Layer**: EJS 페이지(`views/*`) + 정적 리소스(`public/*`)
2. **Application Layer**: Express 라우트 핸들러(`src/server.js`)
3. **Domain Services**
   - 분석 서비스(`src/services/analysisService.js`)
   - 추천 서비스(`src/services/recommendationService.js`)
4. **Persistence Layer**: 파일 기반 저장소(`src/services/storage.js`, `data/app-data.json`)
5. **Utility**: 라벨 매핑(`src/utils/labels.js`)

### 3.2 핵심 처리 흐름
- 작업 생성 요청 → 저장 전 AI/휴리스틱 분석 실행 → 분석 결과 포함 저장
- 피로도 입력 → 최신 피로도 기반 추천 점수 계산
- 분석 수정 저장 → 작업 분석 갱신 + 학습 프로필 갱신
- 주간 기록 조회 → 최근 7일 통계 집계

## 4. 모듈별 기술 요구사항
### 4.1 서버/라우팅 (`src/server.js`)
- Express 미들웨어:
  - `express.urlencoded({ extended: true })`
  - 정적 파일 서빙(`public`)
- 라우트는 입력 검증 및 범위 보정을 서버에서 수행해야 한다.
- 라우트는 존재하지 않는 작업 ID에 대해 404를 반환해야 한다.

### 4.2 분석 서비스 (`analysisService.js`)
- 결과 필드 스키마를 고정해야 한다:
  - difficulty, estimatedMinutes, focusLevel, focusRequired, todaySuitabilityScore, reason, source, agentFrameworkLoaded
- 값 범위 보정:
  - estimatedMinutes: 10~180
  - todaySuitabilityScore: 1~100
- 처리 순서:
  1) Copilot SDK 시도  
  2) 실패 시 GitHub Models 시도(`GITHUB_TOKEN` 필요)  
  3) 실패 시 휴리스틱 fallback
- 프롬프트 입력값은 길이 제한 및 위험 문자 제거로 정제한다.

### 4.3 추천 서비스 (`recommendationService.js`)
- 미완료 작업만 추천 대상으로 계산해야 한다.
- 피로도 구간(고/중/저)에 따라 다른 점수식을 적용해야 한다.
- 정렬 결과는 점수 내림차순을 보장해야 한다.
- 난이도별 그룹화 결과(`easy|medium|hard`)를 제공해야 한다.

### 4.4 저장소 서비스 (`storage.js`)
- 기본 데이터 구조:
  - tasks[]
  - fatigueLogs[]
  - learningProfile(editCount, durationMultiplier, difficultyBias, focusBias)
- 데이터 파일이 없으면 자동 생성해야 한다.
- 쓰기 작업은 `writeQueue` 기반 직렬화로 순차 처리해야 한다.
- `DATA_FILE` 환경변수로 저장 경로를 외부 지정 가능해야 한다.

## 5. 데이터 모델 요구사항
### 5.1 Task
- 필수/주요 필드: `id`, `title`, `dueDate`, `memo`, `completed`, `createdAt`, `updatedAt`
- 분석 필드:
  - `aiAnalysis` (초기 분석)
  - `currentAnalysis` (현재 반영 분석)
- 완료 처리 시 `completedAt` 기록

### 5.2 FatigueLog
- `level`(1~10), `recordedAt`(ISO datetime)

### 5.3 LearningProfile
- `editCount`: 수동 수정 누적 횟수
- `durationMultiplier`: 시간 추정 보정 계수
- `difficultyBias`: 난이도 편향 보정값
- `focusBias`: 집중도 편향 보정값

## 6. 인터페이스/라우트 요구사항
- `GET /` : 홈(피로도 입력 + 추천)
- `POST /fatigue` : 피로도 저장
- `GET /tasks/new` : 작업 추가 화면
- `POST /tasks` : 작업 생성 + 자동 분석
- `GET /tasks/:id` : 작업 상세
- `POST /tasks/:id/edit-analysis` : 분석 수정 저장 + 학습 반영
- `POST /tasks/:id/complete` : 완료 처리
- `POST /tasks/:id/delete` : 작업 삭제
- `GET /analysis` : 분석/추천 결과
- `GET /weekly-record` : 주간 통계

## 7. 환경변수 요구사항
- `PORT`: 서버 포트(기본 3000)
- `GITHUB_TOKEN`: GitHub Models API 사용 시 필요(없으면 fallback 사용)
- `DATA_FILE`: 데이터 파일 절대 경로(배포 시 영속 볼륨 권장)

## 8. 배포/운영 요구사항
- Azure 배포는 `azd up` 기준으로 재현 가능해야 한다.
- 프로덕션 환경에서 `NODE_ENV=production` 사용
- 애플리케이션 로그에서 AI 경로/실패 원인 확인 가능해야 한다.

## 9. 품질 요구사항
### 9.1 신뢰성
- 외부 AI 호출 실패에도 기능 중단 없이 fallback 결과를 제공해야 한다.

### 9.2 유지보수성
- 서비스 계층 분리(분석/추천/저장소) 유지
- 공통 라벨은 `src/utils/labels.js` 단일 소스로 관리

### 9.3 테스트/검증
- 기본 테스트 실행: `npm test` (`node --test`)
- 수동 점검:
  1. 작업 생성 후 `/analysis` 이동
  2. 분석 수정 후 상세 화면 반영
  3. 완료 처리 후 `/weekly-record` 통계 확인

## 10. 보안 요구사항
- 사용자 입력은 서버 측에서 검증/보정해야 한다.
- 비밀값(`GITHUB_TOKEN`)은 환경변수로만 주입하고 코드/문서에 하드코딩 금지
- 프롬프트 인젝션 완화를 위해 AI 프롬프트 입력 정제를 유지해야 한다.

## 11. 제약사항 및 향후 확장
### 11.1 현재 제약
- 단일 인스턴스·파일 저장소 기반(고동시성/대규모 데이터 비최적)
- 인증/권한 체계 미포함

### 11.2 확장 방향
- DB 기반 저장소 전환(SQLite/PostgreSQL 등)
- 사용자 계정/멀티 테넌시
- AI 결과 품질 측정 및 피드백 루프 고도화
