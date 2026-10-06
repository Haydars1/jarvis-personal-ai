// JARVIS Video Pipeline — görsellerden slideshow video üretme
// Cloudflare Workers'da video encoding yapılamaz — bu pipeline GitHub Actions'da çalışır
// Worker tarafı sadece job oluşturur ve sonucu takip eder

// İş akışı:
// 1. POST /api/video/create → job oluştur (prompt, image count, duration, platform)
// 2. Cron veya GitHub Actions runner: job'u al, görselleri üret (CF AI), video birleştir (FFmpeg)
// 3. Bitince R2'ye yaz, job status güncelle
// 4. POST /api/video/publish → YouTube/Instagram'a paylaş (onay ile)

export const VIDEO_PLATFORMS = ['youtube_shorts', 'instagram_reels', 'instagram_post', 'youtube_video'];

export const PLATFORM_SPECS = {
  youtube_shorts: { width: 1080, height: 1920, maxDuration: 60, fps: 30, format: 'mp4' },
  instagram_reels: { width: 1080, height: 1920, maxDuration: 90, fps: 30, format: 'mp4' },
  instagram_post: { width: 1080, height: 1080, maxDuration: 60, fps: 30, format: 'mp4' },
  youtube_video: { width: 1920, height: 1080, maxDuration: 600, fps: 30, format: 'mp4' }
};

// GitHub Actions workflow YAML — video birleştirme
export const VIDEO_WORKFLOW_YAML = `
name: JARVIS Video Pipeline
on:
  workflow_dispatch:
    inputs:
      job_id:
        description: 'Video job ID'
        required: true
      jarvis_url:
        description: 'JARVIS API URL'
        required: true

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - name: Install FFmpeg
        run: sudo apt-get update && sudo apt-get install -y ffmpeg

      - name: Fetch job & render
        env:
          JOB_ID: \${{ inputs.job_id }}
          JARVIS_URL: \${{ inputs.jarvis_url }}
        run: |
          # 1) Job bilgilerini çek
          JOB=$(curl -s "$JARVIS_URL/api/video/job?id=$JOB_ID")
          IMAGES=$(echo "$JOB" | python3 -c "import sys,json; d=json.load(sys.stdin); [print(x) for x in d.get('imageUrls',[])]")
          DURATION=$(echo "$JOB" | python3 -c "import sys,json; print(json.load(sys.stdin).get('perImageSec',3))")
          
          # 2) Görselleri indir
          mkdir -p frames
          i=0
          while IFS= read -r url; do
            curl -sL "$JARVIS_URL$url" -o "frames/img_$(printf '%03d' $i).png"
            i=$((i+1))
          done <<< "$IMAGES"
          
          # 3) FFmpeg ile slideshow video
          ffmpeg -framerate 1/$DURATION -i "frames/img_%03d.png" \\
            -c:v libx264 -pix_fmt yuv420p -vf "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black" \\
            -t 60 output.mp4
          
          # 4) R2'ye yükle (JARVIS API üzerinden)
          BASE64=$(base64 -w0 output.mp4)
          curl -s -X POST "$JARVIS_URL/api/video/complete" \\
            -H "Content-Type: application/json" \\
            -d "{\\"jobId\\":\\"$JOB_ID\\",\\"videoBase64\\":\\"$BASE64\\"}"
`;

export function generateVideoJobSpec(opts = {}) {
  const platform = opts.platform || 'instagram_reels';
  const spec = PLATFORM_SPECS[platform] || PLATFORM_SPECS.instagram_reels;
  return {
    platform,
    spec,
    imageCount: opts.imageCount || 5,
    perImageSec: opts.perImageSec || 3,
    totalDuration: Math.min((opts.imageCount || 5) * (opts.perImageSec || 3), spec.maxDuration),
    topic: opts.topic || '',
    style: opts.style || 'professional automotive, dark background, clean typography'
  };
}
