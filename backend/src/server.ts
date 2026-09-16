import dotenv from "dotenv";

dotenv.config();

import app from "./app.js";

const port = Number(process.env.PORT) || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`RoxStar backend is running on http://0.0.0.0:${port}`);
});
