# Demo recording (5–10 minutes)

Record the **phone** as the owner. Keep the **emulator** (and a third client) on screen too. Speak the lines below. Pause when something happens on screen.

Backend stays local for this recording. Do **not** show Settings unless you are asked how the URL is configured.

## Prep (before you hit Record)

1. Laptop: `docker compose -f infrastructure/docker-compose.yml up -d` then `curl http://localhost:3000/health`
2. Phone and laptop on the **same Wi‑Fi**. Phone already uses `http://10.7.9.169:3000` (change only in **⋮ → Settings** if it fails).
3. Emulator backend URL is `http://10.0.2.2:3000` (also under Settings).
4. Phone user = **sai** (owner). Emulator user = **mun**. Third client = **Rahul** or **Ahmed** (second emulator account, or create a user via API).
5. You need **3 people in the room** before Start spin.
6. If the phone is already in someone else’s room, **Leave room**, then **Create room** so **sai** is the owner.

Suggested names while recording: draft **Practice 1**.

---

## Spoken script (~8 minutes)

### 0:00 — Open the app

“This is RoxStar Voice. Audio is recorded on the phone with Google Oboe. The Node backend owns rooms and the spin wheel. Audio files never leave the device.”

Show Home: Hello, sai. Three buttons only — Record voice, My drafts, Room & spin. **Do not open Settings.**

### 0:40 — Record with echo

Tap **Record voice**.

“Recorder states are Ready, Recording, Saving, Saved. I’ll turn Echo on, then start.”

Toggle **Echo effect** ON. Tap **Start**. Speak for about eight seconds:

“Testing RoxStar echo. This draft stays on the phone.”

Tap **Stop**. Name it **Practice 1**. Tap **Save draft**.

“The WAV is in app-private storage. Only the draft name and duration are sent to the backend.”

### 2:00 — Play the draft

Back → **My drafts**. Tap **Play** on Practice 1. Let two seconds of echo play.

“Playback is local MediaPlayer. Delete would remove the Room row and the WAV file. I’ll keep this one for the room.”

### 2:40 — Create the room (phone is owner)

Back → **Room & spin** → **Create room**.

Point at the six-character code. Tap **Copy room code**.

“I am the room owner. Socket shows Connected. Only I can start the spin.”

Read the code out loud. Type it on the emulator and tap **Join room**.

Wait for **mun joined the room** on the phone.

### 4:00 — Third person

Join the third client with the same code.

“We now have three active members. The backend rejects a spin below three or above twenty.”

### 4:40 — Share draft metadata

On the phone, pick **Practice 1** → **Share draft**.

Point at **Shared drafts** and the live event **sai shared "Practice 1"**.

“That event is draft_shared. The room received metadata, not the audio bytes.”

### 5:20 — Spin (owner only)

Tap **Open spin wheel**.

“If I were not the owner, Start spin would be hidden. I am the owner, so I’ll start it. Android does not run a second timer. The backend eliminates one person every five seconds.”

Tap **Start spin**. Keep the camera on Status: RUNNING and the ✓ / ✗ list. Narrate each elimination. When the winner appears, say the name.

### 7:00 — Disconnect and reconnect

Back to Room. Tap **Disconnect**.

“Socket is Disconnected, but I did not Leave room. Membership is still ACTIVE in Postgres.”

Tap **Reconnect**.

“We send room:join again and replace local state with room_state. The room, participants, and winner are still here.”

### 8:00 — Close

“That is the product: Oboe recording, local drafts, realtime rooms, and a backend-owned spin. Cloud hosting is a separate deploy of the same Docker image.”

Stop recording.

---

## If something goes wrong while filming

| Problem | What to do |
| --- | --- |
| Backend unavailable | Same Wi‑Fi. ⋮ → Settings → confirm `http://10.7.9.169:3000` |
| Start spin says only owner | Leave room on the phone, Create room, have the others rejoin |
| Fewer than 3 players | Do not start spin; join the third client first |
| Keyboard covering Save | Hide the keyboard, then Save draft |
| Phone not in `adb devices` | Unlock phone, allow USB debugging, then reinstall if needed |

## After the video

Keep the file with the submission. Docker / AWS wait until you are happy with this recording.
