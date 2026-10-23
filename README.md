# 아스가르드 파티 MVP

React + Vite 프런트엔드, Express API, Turso와 호환되는 libSQL 데이터베이스로 구성된 파티 모집 사이트입니다. 로컬에서는 별도 계정 없이 SQLite 파일로 실행됩니다. 운영 시 프런트엔드는 GitHub Pages, API는 Node.js 호스팅, DB는 Turso로 분리합니다.

## 로컬 실행

Node.js 20.19 이상(권장 22)을 사용합니다.

```sh
npm ci
cp .env.example .env
npm run dev:api
```

다른 터미널에서 다음 명령을 실행하고 표시된 Vite 주소를 엽니다.

```sh
npm run dev
```

Vite는 `/api` 요청을 `localhost:3000`으로 전달합니다. 개발 중에는 `VITE_API_URL`을 비워 둡니다. `local.db`는 최초 API 실행 시 생성됩니다. 실제 계정이나 샘플 게시글은 자동으로 생성하지 않습니다.

```sh
npm test
npm run build
```

빌드 후에는 API 서버의 `http://localhost:3000`에서도 화면을 볼 수 있습니다. 운영용 `npm start`는 `.env` 파일을 자동으로 읽지 않으므로 호스팅 서비스 환경변수를 설정해야 합니다.

## 구현된 기능

- 영문 아이디와 비밀번호 회원가입·로그인, 세션 로그아웃
- 무작위 복구 코드 발급·다운로드, 비밀번호 재설정, 코드 교체 및 전체 세션 폐기
- 캐릭터 프로필 작성·수정, 기본 비공개, 공개 프로필 공유 링크
- 던전 이름·상세 지역·단계 직접 입력, 던전 뱃지와 동적 필터
- 전투력·신스레벨 직접 입력과 운영자 확인 뱃지 구분
- 인증 이미지 파일 첨부·수치 직접 입력, 운영자 화면 및 CLI 승인·반려
- 고정파티 작성·수정·삭제·모집 마감, 일정과 모집 직업 및 인게임 연락 방법
- 공개 프로필을 멤버로 태그, 마우스·키보드 포커스 미리보기, 모바일 클릭 상세
- 태그된 본인이 태그 제거, 프로필 비공개 전환 시 공개 API에서 제외

던전 이름은 자동완성 목록에서 고르거나 직접 입력할 수 있습니다. 상세 지역과 단계(예: 95, 91~99)는 선택 입력입니다. 프로필에는 최대 20개를 등록할 수 있으며, 모집글에는 한 곳을 지정합니다. 새 던전은 배포나 코드 수정 없이 입력할 수 있습니다. 기존 멘트99 등의 뱃지는 그대로 조회되고 수정 화면에서도 이름과 단계로 인식됩니다. 로그인 아이디와 공개 캐릭터명은 별개이며 로그인 아이디는 공개 API에 포함하지 않습니다.

## Turso 연결

[Turso 공식 시작 안내](https://docs.turso.tech/quickstart)에 따라 계정과 libSQL 호환 DB를 생성합니다. CLI를 설치했다면 다음 명령을 사용할 수 있습니다.

```sh
turso auth login
turso db create asgard-party
turso db show asgard-party --url
turso db tokens create asgard-party
```

DB URL과 토큰을 로컬 `.env` 또는 API 호스팅의 환경변수에 설정합니다.

```dotenv
DATABASE_URL=libsql://YOUR_DATABASE_URL
DATABASE_AUTH_TOKEN=YOUR_SERVER_ONLY_TOKEN
ALLOWED_ORIGINS=https://YOUR_GITHUB_USERNAME.github.io
```

API를 실행하면 필요한 테이블이 생성됩니다. 기존 로컬 SQLite 데이터는 Turso로 자동 복사되지 않습니다. 전환 전에 데이터가 필요하다면 별도 이전을 진행해야 합니다.

DB 토큰은 브라우저 코드, `VITE_` 환경변수, GitHub 저장소에 넣지 않습니다. 클라이언트는 API에만 접근하고, API가 계정 권한을 확인한 뒤 DB를 수정합니다. `.env`, DB 파일과 `node_modules`는 Git에서 제외되어 있습니다.

## API와 GitHub Pages 배포

API는 Node.js를 실행할 수 있는 별도 호스팅에 배포합니다. GitHub Pages는 API 서버를 실행하지 않습니다. DB 무료 플랜과 API 호스팅 비용은 별개입니다.

1. API 호스팅의 설치 명령은 `npm ci --omit=dev`, 시작 명령은 `npm start`로 설정합니다.
2. 위의 Turso 환경변수와 `ALLOWED_ORIGINS`를 설정합니다. 출처는 저장소 경로 없이 `https://username.github.io` 형태입니다. 여러 출처는 쉼표로 구분합니다.
3. 프록시 환경이라면 호스팅 업체의 구조에 맞춰 `TRUST_PROXY_HOPS`를 설정합니다. 기본값은 0이며, 신뢰하는 프록시가 정확히 한 개일 때만 1로 설정합니다.
4. API의 HTTPS 주소에서 `/api/health`가 `{"ok":true}`를 반환하는지 확인합니다.
5. GitHub 저장소의 **Settings → Secrets and variables → Actions → Variables**에 `VITE_API_URL`을 API의 HTTPS 출처로 등록합니다. `/api`는 붙이지 않습니다.
6. **Settings → Pages → Source**를 **GitHub Actions**로 선택합니다.
7. `main` 브랜치에 푸시하면 `.github/workflows/pages.yml`이 테스트·빌드 후 `dist`만 배포합니다. 저장소 하위 경로에서도 실행되도록 상대 경로 빌드를 사용합니다.

API 호스팅에서는 `DATABASE_URL`을 반드시 설정하세요. 파일 시스템이 일시적인 호스팅에서 기본 로컬 DB를 사용하면 재배포 시 데이터가 사라질 수 있습니다. 현재 API의 요청 제한기는 단일 프로세스 기준입니다. 여러 인스턴스로 확장할 때는 공유 제한 저장소 또는 호스팅의 요청 제한 기능이 필요합니다.

### 이 저장소를 Render에 연결하기

`render.yaml`에는 무료 Node API 서비스 설정이 들어 있습니다. Render의 **New → Blueprint**에서 `worldsource93/asgard-party` 저장소를 연결하고 `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `ADMIN_USER_IDS`를 입력합니다. 토큰은 Render 환경변수에만 입력하고 GitHub Actions 변수에는 API 주소만 등록합니다. `NODE_ENV=production`에서는 Turso URL·토큰과 HTTPS 출처가 없으면 서버 시작을 중단합니다.

`ADMIN_USER_IDS`에는 운영 DB의 `developer` 계정 UUID를 넣습니다. 빈 DB에 새로 가입했다면 로컬 계정과 UUID가 다르므로 운영 계정의 값을 확인해야 합니다. 이름이 `developer`라는 이유만으로 관리자가 되지는 않습니다. 기존 계정과 프로필을 유지하려면 로컬 SQLite를 백업한 뒤 [Turso의 SQLite 파일 가져오기](https://docs.turso.tech/cli/db/create)로 별도 이전해야 합니다. DB 파일은 GitHub에 업로드하지 않습니다.

배포 후 프록시 구조를 확인하여 `TRUST_PROXY_HOPS`를 조정하세요. 기본값 0은 전달된 IP 헤더를 신뢰하지 않으므로 프록시 뒤에서는 사용자들이 같은 요청 제한을 공유할 수 있습니다. 정확히 한 프록시를 통과하는 환경임을 확인한 경우 1로 설정합니다.

API가 실행되면 `https://API주소/api/health`를 확인하고 GitHub Actions의 `VITE_API_URL`에 `https://API주소`를 등록합니다. Pages의 Source를 GitHub Actions로 선택한 뒤 **Actions → Deploy React to GitHub Pages → Run workflow**를 실행합니다. 예상 프런트엔드 주소는 `https://worldsource93.github.io/asgard-party/`이며 실제 배포 성공 후 접근할 수 있습니다.

[Render 무료 서비스](https://render.com/docs/free)는 15분간 요청이 없으면 중지되고 다음 요청 시 재시작에 약 1분이 걸릴 수 있습니다. 데이터와 인증 이미지는 Turso에 저장되므로 API 인스턴스의 로컬 파일에 의존하지 않습니다.

## 능력치 인증 운영

회원은 인증 신청에서 신스레벨과 전투력을 직접 입력하고 JPG·PNG·WebP 정지 이미지 1장(최대 5MB, 2,500만 화소)을 첨부합니다. URL 입력은 받지 않습니다. 서버는 이미지 디코딩을 검증하고 방향 보정·최대 2560px 크기 조정·메타데이터 제거 후 WebP로 저장합니다. 저장 결과가 1.5MB를 초과하면 필요한 화면만 잘라 다시 제출하도록 안내합니다. 운영자는 캐릭터명·서버와 신청 수치를 이미지에 대조한 뒤 승인합니다. 이미지 조작을 자동 판별하거나 게임 계정 소유권을 인증하는 기능은 없습니다.

```sh
npm run verify -- list
npm run verify -- approve USER_ID
npm run verify -- reject USER_ID
```

운영 명령은 서버 DB 자격증명이 있는 환경에서만 실행합니다. 인증 신청의 수치가 현재 프로필과 달라도 신청할 수 있으며, 승인 시 신청한 수치와 인증 뱃지를 함께 반영합니다. 신청 이후 캐릭터명·서버·기존 능력치가 변경되면 오래된 신청은 승인할 수 없습니다. 승인·반려 또는 재신청 시 이전 첨부 이미지가 삭제됩니다. 이후 프로필 수치나 캐릭터 정보를 바꾸면 관련 인증 표시가 해제됩니다.

이미지는 Turso 또는 로컬 DB의 별도 `verification_images` 테이블에 BLOB으로 저장합니다. 정적 파일 디렉터리에는 저장하지 않습니다. 운영자 전용 인증 API를 통해서만 조회하며, 목록 API에는 이미지 본문을 싣지 않습니다. MVP는 추가 파일 저장 서비스 없이 실행할 수 있지만 이미지도 DB 저장 용량을 사용합니다. 보관 기간을 길게 늘리거나 업로드 규모를 확대할 때는 별도 비공개 객체 저장소로 이전할 수 있습니다.

## 계정과 저장 정책

비밀번호는 랜덤 salt를 사용하는 scrypt(N=131072, r=8, p=1) 해시로 저장합니다. 고엔트로피 복구 코드와 세션 토큰은 SHA-256 해시만 DB에 저장합니다. 복구 코드는 가입 또는 복구 직후 한 번 보여주고 원문을 다시 조회하지 않습니다. 비밀번호와 복구 코드를 모두 잃으면 복구할 수 없습니다.

브라우저에는 로그인 세션 토큰만 sessionStorage에 보관합니다. 프로필·계정·게시글의 원본은 서버 DB에 있습니다. 토큰 유효기간은 7일이며 브라우저 탭을 닫으면 일반적으로 클라이언트 세션 저장도 종료됩니다. 이메일·전화번호 입력을 받지 않지만 계정 식별자와 사용자가 작성한 콘텐츠는 저장합니다. 운영 호스팅의 접속 로그 정책은 별도 확인이 필요합니다.

## MVP 범위

현재 목록은 최근 200개를 조회하며 검색·필터는 그 범위에서 적용됩니다. 페이지네이션, 게임 API 자동 인증, 사이트 내 채팅, 자동 태그 동의, 회원 탈퇴 화면은 포함하지 않습니다. 실제 Turso 연결과 공개 배포에는 사용자의 Turso 계정, API 호스팅 및 GitHub 저장소 설정이 필요합니다.

브라우저 검증은 설치된 Google Chrome을 사용합니다.

```sh
npm run test:e2e
```

이 테스트는 별도 `e2e.db`에 테스트 계정을 생성하고, 회원가입·공개 프로필·모집글 작성·데스크톱 미리보기·모바일 상세 표시를 확인합니다. 테스트 DB는 Git에 포함되지 않습니다.

## 운영자 이미지 검토 화면

서버 환경변수 `ADMIN_USER_IDS`에 운영자 계정 UUID를 쉼표로 구분해 등록하고 API를 재시작합니다. 등록된 계정으로 로그인하면 상단에 **인증 검토** 메뉴가 나타납니다. 브라우저가 아닌 API에서 운영자 권한을 검사합니다. 계정 UUID는 해당 계정으로 로그인한 `/api/me` 응답 또는 운영 DB의 `users.id`에서 확인할 수 있습니다.

검토 화면은 대기·승인·반려 목록, 첨부 이미지 미리보기 및 크게 보기, 신청값과 현재 프로필 수치 비교, 검토 의견을 제공합니다. 이미지의 캐릭터명·서버·신청 수치가 일치함을 확인한 후 승인할 수 있고 반려 시 사유가 필요합니다. 재신청 또는 이미 처리된 신청에 대한 오래된 승인 요청은 거절됩니다. 승인·반려 이후 첨부 이미지를 제거하고 검토 결과와 운영자 ID를 보관합니다. 이전 버전의 URL 방식 신청은 호환 조회를 지원하지만 신규 신청은 파일 첨부만 허용합니다.

능력치 뱃지는 미인증 상태에서도 `신스 7레벨`, `전투력 92,000`처럼 표시되며, 실제 검토 승인 후에만 인증 체크가 추가됩니다.
