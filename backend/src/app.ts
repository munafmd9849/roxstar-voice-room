import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import swaggerUi from "swagger-ui-express";

import { errorHandler } from "./middleware/error-handler.js";
import { openapiDocument } from "./config/openapi.js";
import roomRouter from "./routes/room.routes.js";
import userRouter from "./routes/user.routes.js";

const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));

app.get("/health", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "roxstar-backend"
  });
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument));

app.use("/api/users", userRouter);
app.use("/api/rooms", roomRouter);

app.use(errorHandler);

export default app;
