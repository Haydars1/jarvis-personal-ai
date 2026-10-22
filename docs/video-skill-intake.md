# Video → skill intake (proposal-only)

Videos sent to ChatGPT do not automatically transfer to this app. This authenticated endpoint accepts *video-derived text* (transcript, frame observations or notes), stores it in the existing searchable video learning memory, and creates skill/plugin candidates with evidence. It does not accept raw MP4 uploads.

`POST /api/learning/video-skills`

```json
{
  "title": "Jenkins: Build, Test, Deploy",
  "screen_text": "Jenkins Jenkinsfile Build Test Deploy Docker Kubernetes"
}
```

`GET /api/learning/video-skills` lists the recent records.

Every candidate starts as **not installed / not tested**. Names displayed in videos are not trustable instructions. Before implementation, independently verify an official API, permissions, licensing, costs, applicability and passing tests. No automatic execution or production deploy is performed. ChatGPT plugin connections can only be activated with explicit user action inside ChatGPT. Existing GitHub Actions can do the CI work shown in the example Jenkins video; Jenkins is not automatically needed.

The API is protected by the app owner session and limits input sizes. This endpoint does not silently forward private video bytes from ChatGPT to another server.
