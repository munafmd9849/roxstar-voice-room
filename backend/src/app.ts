import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

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

export default app;
