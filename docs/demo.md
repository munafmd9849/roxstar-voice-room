# Demo recording (5–10 minutes)

Record a screen capture of the Android app plus a second client (emulator or another phone). Keep the laptop backend running.

## Setup

1. `docker compose -f infrastructure/docker-compose.yml up -d`
2. Confirm `curl http://localhost:3000/health`
3. Phone: Backend URL = `http://YOUR-LAN-IP:3000` (same Wi‑Fi)
4. Emulator: Backend URL = `http://10.0.2.2:3000`
5. Need **3 people** in the room before Start Spin (phone owner + two joiners)

## Checklist (say each step out loud)

1. Open the app and enter a name (first launch only)
2. Record voice with Echo ON
3. Stop, save draft, play it from My drafts
4. Open Room & spin → Create room → show the 6-character code
5. Second client joins with that code → show `user_joined` / participant list
6. Third client joins (or create a third user on emulator/API)
7. Share a draft → show `draft_shared`
8. **Owner only:** Start spin
9. Show `RUNNING`, one elimination every 5 seconds, then the winner
10. Toggle airplane mode or kill the socket → reconnect → room state returns (membership is not left)

Do not start spin from a non-owner device. Leave and create your own room if you joined someone else's.

## After recording

Keep the video with the repo submission. The hosted HTTPS URL (when you have it) should appear in the Android Backend URL field during the cloud portion of the demo.
