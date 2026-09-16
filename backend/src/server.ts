import dotenv from "dotenv";
import { createServer } from "node:http";

dotenv.config();

import app from "./app.js";
import { createSocketServer } from "./socket/index.js";

const port = Number(process.env.PORT) || 3000;

const httpServer = createServer(app);
createSocketServer(httpServer);

httpServer.listen(port, "0.0.0.0", () => {
  console.log(`RoxStar backend is running on http://0.0.0.0:${port}`);
});
