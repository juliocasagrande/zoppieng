import "express-async-errors";
import express from "express";
import cors from "cors";
import { companiesRouter } from "./modules/companies/routes.js";
import { usersRouter } from "./modules/users/routes.js";
import { subscriptionsRouter, paymentWebhookRouter } from "./modules/subscriptions/routes.js";
import { reportsRouter } from "./modules/reports/routes.js";
import { fieldRouter } from "./modules/field/routes.js";
import { accessoriesRouter } from "./modules/accessories/routes.js";
import { fieldOptionsRouter } from "./modules/fieldOptions/routes.js";
import { reviewRouter } from "./modules/review/routes.js";
import { bestPracticesRouter } from "./modules/bestPractices/routes.js";
import { verifyRouter } from "./modules/verify/routes.js";
import { registrationRouter } from "./modules/registration/routes.js";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "5mb" }));

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.use("/companies", companiesRouter);
  app.use("/users", usersRouter);
  app.use("/subscriptions", subscriptionsRouter);
  app.use("/webhooks", paymentWebhookRouter);
  app.use("/reports", reportsRouter);
  app.use("/field", fieldRouter);
  app.use("/accessories", accessoriesRouter);
  app.use("/field-options", fieldOptionsRouter);
  app.use("/review", reviewRouter);
  app.use("/best-practices", bestPracticesRouter);
  app.use("/verify", verifyRouter);
  app.use("/register", registrationRouter);

  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
