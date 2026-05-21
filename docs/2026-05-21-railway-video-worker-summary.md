# Railway Video Worker Summary

## 목적

채팅방 영상 업로드를 위해 Vercel이 아닌 Railway에서 ffmpeg 변환 worker를 실행한다.

Vercel은 영상 변환처럼 CPU를 오래 쓰는 작업에 적합하지 않아서, Next 앱은 업로드/메시지 생성만 담당하고 Railway worker가 영상 변환을 담당하는 구조로 준비했다.

## Railway 리소스

```text
Project: loco-video-worker
Project ID: 41da7e3c-783d-4d10-938e-392e9fa2631a
Environment: production
Service: video-worker
Service ID: fd13428a-adcf-4d07-9a81-d5e4809a73b8
Public URL: https://video-worker-production-f4d6.up.railway.app
Health URL: https://video-worker-production-f4d6.up.railway.app/health
```

Health check 확인 결과:

```json
{"ok":true}
```

## 로컬 코드 위치

```text
workers/video-worker
```

주요 파일:

```text
workers/video-worker/src/server.js
workers/video-worker/Dockerfile
workers/video-worker/railway.json
workers/video-worker/.env.example
workers/video-worker/README.md
```

## Worker 역할

```text
1. Supabase Storage 임시 원본 영상 다운로드
2. ffmpeg로 480p H264 mp4 변환
3. webp 썸네일 생성
4. 최종 영상/썸네일을 별도 버킷에 업로드
5. 원본 영상 삭제
6. chat_messages row를 최종 영상 메시지로 업데이트
```

## 변환 설정

최종 저장 영상:

```text
해상도: 480p
비디오 코덱: H264 / libx264
비디오 bitrate: 900k 기준, max 1200k
FPS: 30
오디오 코덱: AAC
오디오 bitrate: 96k
컨테이너: mp4
faststart 적용
```

썸네일:

```text
형식: webp
추출 시점: 1초
가로 기준: 480px
quality: 78
```

## Supabase Storage 버킷

생성된 버킷:

```text
message-video-originals
message-videos
message-video-thumbnails
```

정책:

```text
message-video-originals: 임시 원본 저장용, worker 처리 후 삭제
message-videos: 최종 480p mp4 저장
message-video-thumbnails: webp 썸네일 저장
```

현재 파일 크기 제한:

```text
50MB
```

## Railway 환경변수

Railway `video-worker` 서비스에 설정된 변수:

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
WORKER_SECRET
ORIGINAL_VIDEO_BUCKET=message-video-originals
PROCESSED_VIDEO_BUCKET=message-videos
VIDEO_THUMBNAIL_BUCKET=message-video-thumbnails
```

주의:

```text
SUPABASE_SERVICE_ROLE_KEY와 WORKER_SECRET은 절대 브라우저 코드에 노출하면 안 된다.
Next 앱에서 worker를 호출할 때도 서버 API Route 안에서만 사용해야 한다.
```

## Worker API

Health:

```http
GET /health
```

영상 처리:

```http
POST /process-video
```

인증:

```text
x-worker-secret: <WORKER_SECRET>
```

또는:

```text
Authorization: Bearer <WORKER_SECRET>
```

요청 예시:

```json
{
  "messageId": "chat message id",
  "originalBucket": "message-video-originals",
  "originalPath": "user-id/video-id.mp4",
  "videoBucket": "message-videos",
  "thumbnailBucket": "message-video-thumbnails"
}
```

응답은 즉시 `202`로 반환하고, 실제 ffmpeg 변환은 Railway worker 내부에서 백그라운드로 계속 진행한다.

```json
{
  "ok": true,
  "messageId": "chat message id",
  "status": "processing"
}
```

처리 성공 시 worker가 `chat_messages`를 아래 형태로 업데이트한다.

```json
{
  "type": "video",
  "status": "ready",
  "video_url": "https://...",
  "thumbnail_url": "https://...",
  "video_path": "user-id/video-id_480p.mp4",
  "thumbnail_path": "user-id/video-id_thumb.webp",
  "duration": 30,
  "width": 854,
  "height": 480
}
```

## 배포 검증 기록

실행한 검증:

```text
node --check src/server.js
railway up --service video-worker --detach
curl -fsS https://video-worker-production-f4d6.up.railway.app/health
```

결과:

```text
Railway deployment: SUCCESS
Health response: {"ok":true}
```

## 있었던 이슈

초기 Docker 이미지가 Node 20이라 Supabase SDK에서 WebSocket 지원 오류가 발생했다.

해결:

```text
Dockerfile을 node:22-bookworm-slim으로 변경
package.json engines를 >=22로 변경
```

## 다음 작업

Next 앱 연결 작업에서 사용할 기본 흐름:

```text
1. Next API가 signed upload URL 생성
2. 브라우저가 Supabase message-video-originals 버킷에 직접 업로드
3. Next API가 chat_messages에 처리중 메시지 생성
4. Next API가 Railway worker 호출
5. Railway worker가 480p 영상/썸네일 생성
6. Railway worker가 chat_messages를 최종 상태로 UPDATE
7. 채팅 화면이 UPDATE 실시간 이벤트로 처리중 메시지를 갱신
```

추가로 확인할 작업:

```text
1. Vercel Production 환경변수에 VIDEO_WORKER_URL / VIDEO_WORKER_SECRET 추가
2. 실제 모바일 영상 업로드 테스트
3. 긴 영상/동시 업로드 시 Railway 비용과 처리 시간 확인
```

현재 메시지 저장 방식:

```text
kind: file
content.type: video
```

이유:

```text
현재 chat_messages.kind DB CHECK 제약이 text/image/file/system만 허용한다.
DB 마이그레이션 없이 바로 안전하게 적용하기 위해 kind는 file을 사용하고, 실제 영상 여부는 content.type으로 구분한다.
```
