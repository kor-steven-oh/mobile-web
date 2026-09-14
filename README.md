# SDD 2026

S.LSI Developer Day 모바일 웹앱. React, TypeScript, vinext 기반.

```sh
npm install
npm run dev
```

`npm run build`로 배포 빌드를 생성합니다.

- `/`: 시작 화면
- `/home`: 저장한 세션 중 아직 시작하지 않은 가장 이른 세션(KST 기준), 빠른 메뉴, 추천 프로그램
- `/program`: 5개 강연장 선택(101 AP, 102 CP, 201 LSI, 206 Sensor, 208 직속), 강연장별 세션 5개, 시간순 세션, 검색 및 상세 정보
- `/event`: 이벤트 상세 및 관심 이벤트 저장
- `/mypage`: 저장한 세션과 이벤트

행사는 2026년 10월 15일 오전 10시 The UniverSE에서 시작합니다. 세부 세션, 연사 및 이벤트는 예시입니다. `app/data.ts`에서 수정합니다. 북마크와 관심 이벤트는 현재 브라우저의 localStorage에 저장됩니다. 회원가입이나 참가 신청 기능은 포함하지 않습니다. `public/sdd-original.png`는 제공된 로고 원본입니다. Start에서는 원본 이미지의 SDD 심볼 영역만 비율 그대로 표시하고, 바로 아래에 Pretendard로 2026을 배치합니다.

기본 글꼴은 [Pretendard Variable](https://github.com/orioncactus/pretendard)의 공식 가변 다이나믹 서브셋 웹폰트(v1.3.9)를 사용합니다.

## Cloudflare Workers 배포

`vote2`와 같은 Cloudflare 계정에 독립 Worker `sdd-2026`으로 배포합니다. 이 앱은 vinext의 Workers 빌드를 사용하며, 배포 설정은 `wrangler.jsonc`에 있습니다. 데이터베이스나 추가 시크릿은 필요하지 않습니다.

```sh
# 최초 인증 (이미 로그인되어 있으면 생략)
npx wrangler login

# 빌드 및 배포
npm run deploy

# 배포 없이 빌드와 업로드 구성만 검증
npm run deploy:check

# 바인딩 변경 시 타입 재생성
npm run cf:typegen
```

빌드가 생성한 `dist/server/wrangler.json`을 배포에 사용합니다. 출력 파일을 직접 수정하지 마세요. 로컬 개발은 계속 `npm run dev`를 사용합니다. 기존 `.openai/hosting.json`은 Sites 배포 기록이며 위 명령은 Cloudflare 계정에 직접 배포합니다.

저장한 세션과 관심 이벤트는 브라우저 및 사이트 주소별로 별도 저장되므로, localhost에서 저장한 항목은 배포 주소로 자동 이동하지 않습니다.

운영 주소: https://sdd-2026.slsi.workers.dev
