import { io } from "socket.io-client";

const [roomId, userId, serverUrl = "http://localhost:3000"] = process.argv.slice(2);

if (!roomId || !userId) {
  console.error("Usage: npm run socket:manual -- <roomId> <userId> [serverUrl]");
  process.exitCode = 1;
} else {
  const socket = io(serverUrl);

  socket.on("connect", () => {
    console.log("Connected", socket.id);
    socket.emit("room:join", { roomId, userId });
  });
  socket.on("room_state", (payload) => console.log("room_state", payload));
  socket.on("user_joined", (payload) => console.log("user_joined", payload));
  socket.on("user_left", (payload) => console.log("user_left", payload));
  socket.on("socket:error", (payload) => console.error("socket:error", payload));
  socket.on("disconnect", (reason) => console.log("Disconnected", reason));
}
