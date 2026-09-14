# SDD 2026

S.LSI Developer Day 모바일 웹앱. React, TypeScript, vinext 기반.

```sh
npm install
npm run dev
```

`npm run build`로 배포 빌드를 생성합니다.

- `/`: 시작 화면
- `/home`: 키노트, 빠른 메뉴, 추천 프로그램
- `/program`: 날짜·강연장 필터, 시간순 세션, 검색 및 상세 정보
- `/event`: 이벤트 상세 및 관심 이벤트 저장
- `/mypage`: 저장한 세션과 이벤트

일정, 장소, 연사 및 이벤트는 예시입니다. `app/data.ts`에서 수정합니다. 북마크와 관심 이벤트는 현재 브라우저의 localStorage에 저장됩니다. 회원가입이나 참가 신청 기능은 포함하지 않습니다. 제공된 로고의 기하학적 형태와 색상을 CSS로 재구성하고 연도를 2026으로 표기했습니다.
