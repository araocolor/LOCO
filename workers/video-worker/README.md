# LOCO Video Worker

Railway에서 실행할 채팅 영상 변환 worker입니다.

## 역할

- Supabase Storage 임시 원본 영상 다운로드
- ffmpeg로 480p H264 mp4 변환
- webp 썸네일 생성
- 최종 영상/썸네일을 별도 버킷에 업로드
- 원본 즉시 삭제
- `chat_messages` row를 최종 영상 메시지로 업데이트

## Endpoint

```http
GET /health
POST /process-video
```

`POST /process-video`는 `x-worker-secret` 또는 `Authorization: Bearer <secret>` 인증이 필요합니다.

```json
{
  "messageId": "chat message id",
  "originalBucket": "message-video-originals",
  "originalPath": "user-id/video-id.mp4",
  "videoBucket": "message-videos",
  "thumbnailBucket": "message-video-thumbnails"
}
```

## Railway 환경변수

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
WORKER_SECRET
ORIGINAL_VIDEO_BUCKET=message-video-originals
PROCESSED_VIDEO_BUCKET=message-videos
VIDEO_THUMBNAIL_BUCKET=message-video-thumbnails
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버 전용 키입니다. 브라우저 코드에 노출하면 안 됩니다.

## Supabase Storage 버킷

```text
message-video-originals
message-videos
message-video-thumbnails
```

원본 버킷은 임시 저장용입니다. worker가 처리 후 즉시 삭제합니다.

## 로컬 실행

```bash
npm install
npm start
```

로컬에서 실제 변환을 테스트하려면 시스템에 `ffmpeg`와 `ffprobe`가 설치되어 있어야 합니다.
