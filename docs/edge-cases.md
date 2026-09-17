# Edge cases, trade-offs, and limitations

## Implemented and tested

| Case | Behavior |
| --- | --- |
| Duplicate spin start | `409 SPIN_ALREADY_RUNNING` |
| Fewer than 3 players | start rejected |
| More than 20 players | start rejected rather than silently dropping people |
| Member leaves during a running spin | participant is eliminated immediately; spin continues |
| Reconnect during a spin | `room:join` / `room:state` returns latest spin in `room_state` |
| Socket disconnect | presence drops; REST membership stays `ACTIVE` |
| Repeated join/leave | membership row is reused, not deleted |
| Duplicate draft share | returns `duplicate: true` and does not rebroadcast |

## Trade-offs

- Audio stays on-device so Socket.IO and the database never handle media files.
- One Node process owns the 5-second spin timer. That is enough for this assessment and avoids Redis/Kafka.
- Users are created by name only. There is no auth system.

## Known limitations

- Cloud hosting still needs an AWS/GCP/Azure account and a public HTTPS URL.
- Local-only Docker Compose is for development. The assessment requires a hosted endpoint for final submission.
