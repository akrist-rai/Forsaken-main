import Router from "@koa/router";
import { z } from "zod";
import {
  authenticate,
  requireRole,
  validate,
} from "../middleware/index.ts";
import {
  listDrivers,
  listExpiringDrivers,
  updateDriver,
} from "../services/driverService.ts";

const updateDriverSchema = z.object({
  status: z.enum(["on_duty", "off_duty", "suspended"]).optional(),
  licenseExpiresAt: z.string().datetime().optional(),
  licenseCategory: z.enum(["truck", "van", "bike", "multi"]).optional(),
  safetyScore: z.number().int().min(0).max(100).optional(),
});

const driverRouter = new Router({ prefix: "/api/drivers" });

driverRouter.use(authenticate());

driverRouter.get("/", requireRole("manager", "dispatcher", "safety", "finance"), async (ctx) => {
  const data = await listDrivers();
  ctx.body = { success: true, count: data.length, data };
});

driverRouter.get("/expiring-licences", requireRole("manager", "safety"), async (ctx) => {
  const data = await listExpiringDrivers();
  ctx.body = { success: true, count: data.length, data };
});

driverRouter.patch(
  "/:id",
  requireRole("manager", "safety"),
  validate(updateDriverSchema),
  async (ctx) => {
    const payload = ctx.state.validated as z.infer<typeof updateDriverSchema>;
    const data = await updateDriver(ctx.params.id, payload);
    ctx.body = { success: true, data };
  }
);

export default driverRouter;
