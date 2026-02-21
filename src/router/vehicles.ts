import Router from "@koa/router";
import { z } from "zod";
import {
  authenticate,
  requireRole,
  validate,
} from "../middleware/index.ts";
import {
  addMaintenance,
  completeMaintenance,
  createVehicle,
  listInShopVehicles,
  listVehicles,
  updateVehicleStatus,
} from "../services/vehicleService.ts";
import { getLegacyVehicleKpis } from "../services/analyticsService.ts";

const createVehicleSchema = z.object({
  name: z.string().min(2).optional(),
  model: z.string().min(1).optional(),
  plate: z.string().min(3),
  vehicleType: z.enum(["truck", "van", "bike"]).optional(),
  maxLoadKg: z.number().int().positive().optional(),
  odometerKm: z.number().int().nonnegative().optional(),
  region: z.string().min(2).optional(),
  acquisitionCost: z.number().nonnegative().optional(),

  // legacy fields to keep old frontend calls compatible
  unitNumber: z.string().min(2).optional(),
  mileage: z.number().int().nonnegative().optional(),
});

const maintenanceSchema = z.object({
  note: z.string().min(3),
  cost: z.number().nonnegative().default(0),
});

const statusSchema = z.object({
  status: z.enum(["available", "on_trip", "in_shop", "retired"]),
});

const vehicleRouter = new Router({ prefix: "/api/vehicles" });

vehicleRouter.use(authenticate());

vehicleRouter.get("/", requireRole("manager", "dispatcher", "safety", "finance"), async (ctx) => {
  const data = await listVehicles(ctx.state.user!.role);
  ctx.body = { success: true, count: data.length, data };
});

vehicleRouter.get("/kpis", requireRole("manager", "finance"), async (ctx) => {
  const data = await getLegacyVehicleKpis();
  ctx.body = { success: true, data };
});

vehicleRouter.get("/in-shop", requireRole("manager", "dispatcher"), async (ctx) => {
  const data = await listInShopVehicles();
  ctx.body = { success: true, count: data.length, data };
});

vehicleRouter.post("/", requireRole("manager"), validate(createVehicleSchema), async (ctx) => {
  const payload = ctx.state.validated as z.infer<typeof createVehicleSchema>;
  const vehicle = await createVehicle({
    name: payload.name ?? payload.unitNumber ?? "Fleet Vehicle",
    model: payload.model ?? "GEN",
    plate: payload.plate,
    vehicleType: payload.vehicleType ?? "van",
    maxLoadKg: payload.maxLoadKg ?? 1000,
    odometerKm: payload.odometerKm ?? payload.mileage ?? 0,
    region: payload.region ?? "unspecified",
    acquisitionCost: payload.acquisitionCost,
  });
  ctx.status = 201;
  ctx.body = { success: true, data: vehicle };
});

vehicleRouter.patch("/:id/status", requireRole("manager"), validate(statusSchema), async (ctx) => {
  const payload = ctx.state.validated as z.infer<typeof statusSchema>;
  const vehicle = await updateVehicleStatus(ctx.params.id, payload.status);
  ctx.body = { success: true, data: vehicle };
});

vehicleRouter.post(
  "/:id/maintenance",
  requireRole("manager"),
  validate(maintenanceSchema),
  async (ctx) => {
    const payload = ctx.state.validated as z.infer<typeof maintenanceSchema>;
    const log = await addMaintenance(ctx.params.id, {
      note: payload.note,
      cost: payload.cost,
      role: ctx.state.user!.role,
    });

    ctx.status = 201;
    ctx.body = { success: true, data: log };
  }
);

vehicleRouter.patch(
  "/:id/maintenance/:logId/complete",
  requireRole("manager"),
  async (ctx) => {
    const log = await completeMaintenance(ctx.params.id, ctx.params.logId);
    ctx.body = { success: true, data: log };
  }
);

export default vehicleRouter;
