# Spin state machine

```mermaid
stateDiagram-v2
  [*] --> WAITING
  WAITING --> RUNNING: owner starts, 3-20 players
  RUNNING --> COMPLETED: one winner remains
  RUNNING --> ABORTED: no valid participant left
  WAITING --> ABORTED: reserved
```

Rules enforced only on the backend:

- 3 to 20 active members
- room owner starts the spin
- one active spin per room
- one elimination every 5 seconds
- last remaining eligible user is the winner
- events persist before broadcast: `SPIN_STARTED` → `USER_ELIMINATED`* → `WINNER_ANNOUNCED`

Android displays these events. It does not run a second timer.
