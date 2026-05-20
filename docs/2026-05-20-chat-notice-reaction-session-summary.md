# 채팅방 공지/투표/반응 작업 정리

작성일: 2026-05-20

## DB 테이블

사용자가 Supabase에서 공지/투표/반응 관련 SQL 실행을 완료했다.

생성된 전제 테이블:

```txt
chat_room_notices
chat_room_notice_reads
chat_room_notice_reactions
chat_room_notice_votes
chat_message_reactions
```

역할:

```txt
chat_room_notices
- 채팅방별 공지/투표 본문
- kind: notice | vote
- 방장/관리자가 작성/수정/삭제
- deleted_at 숨김 삭제

chat_room_notice_reads
- 공지별 회원 읽음 기록
- notice_id + user_id 1회

chat_room_notice_reactions
- 공지별 반응
- heart / like / dislike
- notice_id + user_id 1개만

chat_room_notice_votes
- 공지 투표
- agree / disagree / abstain
- notice_id + user_id 1개만

chat_message_reactions
- 채팅 메시지 감정표현
- heart / like / laugh / wow / sad
- message_id + user_id 1개만
```

## 코드 작업

수정/추가한 주요 파일:

```txt
src/app/(main)/messages/_types.ts
src/app/(main)/messages/page-client.tsx
src/app/(main)/messages/_components/ChatDrawer.tsx
src/app/(main)/messages/_components/MessageBubble.tsx
src/app/api/chat/rooms/[id]/messages/route.ts
```

추가한 API:

```txt
src/app/api/chat/rooms/[id]/notices/route.ts
src/app/api/chat/notices/[noticeId]/route.ts
src/app/api/chat/notices/[noticeId]/read/route.ts
src/app/api/chat/notices/[noticeId]/reaction/route.ts
src/app/api/chat/notices/[noticeId]/vote/route.ts
src/app/api/chat/messages/[id]/reactions/route.ts
```

## 구현 내용

1. 공지/투표

- `chat_room_notices` 기준으로 공지/투표 목록 조회
- 공지 작성 시 `notice` / `vote` 선택 가능
- `공지/투표` 탭에서 날짜별 목록 표시
- 읽음 카운트 표시
- 읽지 않은 공지가 있으면 채팅 상단 공지바 표시
- 공지바 클릭 시 `공지/투표` 탭으로 이동하면서 읽음 처리

2. 공지 반응

- 반응: 하트 / 좋아요 / 싫어요
- 한 회원은 공지 하나에 반응 하나만 선택
- 같은 반응을 다시 누르면 취소
- 다른 반응을 누르면 변경

3. 투표

- 선택지: 찬성 / 반대 / 무효
- 한 회원은 투표 공지 하나에 하나만 선택
- 다른 선택지를 누르면 변경

4. 채팅 메시지 반응

- 반응: 하트 / 좋아요 / 웃겨요 / 놀라워요 / 슬퍼요
- 한 회원은 메시지 하나에 반응 하나만 선택
- 같은 반응을 다시 누르면 취소
- 메시지 조회 API에서 `reaction_counts`, `my_reaction` 내려줌

## 검증

```txt
git diff --check 통과
npx tsc --noEmit --pretty false 통과
3001 서버 실행 중
공지 API GET /api/chat/rooms/[roomId]/notices 200 응답 확인
```

## 주의 및 다음 작업

1. 실제 UI 수동 검증 필요

- 공지 작성
- 미읽은 회원에게만 공지바 노출
- 공지바 클릭 후 읽음 처리
- 공지 반응 토글
- 투표 선택/변경
- 메시지 반응 토글

2. 기존 `chat_rooms.notice` 기반 코드/API는 아직 일부 남아 있음

- `src/app/api/chat/rooms/[id]/notice/route.ts`
- `ChatDrawer`의 과거 공지 작성 흐름은 대부분 새 notices API로 전환했지만, 오래된 API는 정리 후보

3. 채팅 메시지 반응 UI는 현재 말풍선 아래에 모든 반응 버튼이 노출되는 구조

- 디자인 다듬기 필요 가능성 있음

4. 공지 수정/삭제 UI는 API만 있고 아직 화면 버튼은 없음

- 필요 시 방장 전용 수정/삭제 액션 추가

## 현재 서버

```txt
http://localhost:3001
npm run dev -- -p 3001
```
