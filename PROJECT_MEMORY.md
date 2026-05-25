# Project Memory

## 절대 주의 / 변경 금지

## 핵심 동선

## 오류 원인과 해결 기록

### 2026-05-25 - 로그인 후 내클래스 목록 미노출
- 증상: 로그인 직후 CLASS의 내클래스 목록이 비고, 새로고침 후에만 표시됨.
- 원인: `AuthProvider`가 초기 `getSession()`만 실행하고 로그인 상태 변경을 구독하지 않아 `userId`가 갱신되지 않음.
- 해결: `src/lib/auth-context.tsx`에 `supabase.auth.onAuthStateChange` 구독을 추가해 로그인 즉시 사용자 상태를 동기화함.
- 검증: `npm run lint -- src/lib/auth-context.tsx` 통과, 커밋 `8d7f85e`로 `main`에 푸시됨.

## 최근 중요한 변경

## 미해결 / 리스크
