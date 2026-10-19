import assert from 'node:assert/strict';
import { rm, stat } from 'node:fs/promises';
import { downloadYouTubeMedia } from '../.github/scripts/cloud-tool-runner.mjs';

// Public, short, real-world YouTube video. No owner sessions, database writes or AI tokens.
const video='https://www.youtube.com/watch?v=jNQXAC9IVRw';
const media=await downloadYouTubeMedia(video);
try{
  assert.ok(media.audioChunks.length>0,'Real video audio was not downloaded/segmented');
  assert.ok(media.frames.length>0,'Real video frames were not extracted');
  const audioSize=(await stat(media.audioChunks[0].path)).size;
  const frameSize=(await stat(media.frames[0].path)).size;
  assert.ok(audioSize>1000,'Audio segment is unexpectedly empty');
  assert.ok(frameSize>1000,'Video frame is unexpectedly empty');
  console.log('YOUTUBE_LIVE_MEDIA_SMOKE',JSON.stringify({
    video, audio_chunks:media.audioChunks.length,visual_frames:media.frames.length,
    duration_seconds:media.duration,audio_bytes:audioSize,frame_bytes:frameSize
  }));
} finally{
  await rm(media.root,{recursive:true,force:true});
}
