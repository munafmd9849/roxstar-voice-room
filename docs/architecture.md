# System architecture

```mermaid
flowchart TD
  user[User]
  android[Android app]
  rest[REST]
  socket[Socket.IO]
  node[Node.js backend]
  pg[PostgreSQL]

  user --> android
  android --> rest
  android --> socket
  rest --> node
  socket --> node
  node --> pg
```

The Android app owns local audio. The backend owns room membership, shared draft metadata, and the spin lifecycle. PostgreSQL is the source of truth. Socket.IO only broadcasts events; it never carries audio bytes.
