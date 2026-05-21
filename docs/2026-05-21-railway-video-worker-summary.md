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

아직 Next 앱과 worker는 연결되지 않았다.

남은 작업:

```text
1. 채팅 첨부 패널에서 사진 옆에 lucide 영상 아이콘 추가
2. 영상 파일 input 추가
3. 모바일 업로드 전 1차 제한/검사 추가
4. 원본 영상을 message-video-originals 버킷에 업로드
5. chat_messages에 processing 상태 메시지 생성
6. Next 서버 API Route에서 Railway worker 호출
7. worker 완료 후 video 메시지를 화면에서 렌더링
8. 실패 상태 UI 처리
```

권장 메시지 kind:

```text
video
```

현재 `src/app/api/chat/_lib.ts`의 `ChatMessageKind`에는 `video`가 아직 없으므로 연결 작업 때 추가해야 한다.
