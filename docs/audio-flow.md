# Audio flow

```
Microphone
   ↓
Oboe input stream
   ↓
PCM samples
   ↓
Echo delay line  (optional, ~250 ms / 0.4 decay)
   ↓
WAV writer  (mono, 16-bit PCM)
   ↓
App-private storage
   ↓
Local Draft metadata  (Android Room)
   ↓
Playback via MediaPlayer
```

Audio never leaves the device. `POST /api/drafts` and `draft_shared` send metadata only: name, duration, and a local file path string.
