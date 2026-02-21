import Router from "@koa/router";
import { z } from "zod";
import {
  authenticate,
  requireRole,
  validate,
} from "../middleware/index.ts";
import {
  addFuelLog,
  cancelTrip,
  completeTrip,
  createTrip,
  dispatchTrip,
  listTrips,
} from "../services/tripService.ts";

const createTripSchema = z.object({
  vehicleId: z.string().min(1),
  driverId: z.string().min(1),
  cargoWeightKg: z.number().nonnegative().default(0),
  cargoId: z.string().optional(),
  origin: z.string().min(2),
  destination: z.string().min(2),
  scheduledAt: z.string().datetime(),
  revenue: z.number().nonnegative().optional(),
});

const completeTripSchema = z.object({
  finalOdometerKm: z.number().int().nonnegative(),
  fuelLiters: z.number().positive(),
  fuelCost: z.number().nonnegative(),
  completedAt: z.string().datetime().optional(),
});

const fuelLogSchema = z.object({
  liters: z.number().positive(),
  cost: z.number().nonnegative(),
  loggedAt: z.string().datetime().optional(),
});

const tripRouter = new Router({ prefix: "/api/trips" });

tripRouter.use(authenticate());

tripRouter.get("/", requireRole("manager", "dispatcher", "safety", "finance"), async (ctx) => {
  const data = await listTrips();
  ctx.body = { success: true, count: data.length, data };
});

tripRouter.post(
  "/",
  requireRole("manager", "dispatcher"),
  validate(createTripSchema),
  async (ctx) => {
    const payload = ctx.state.validated as z.infer<typeof createTripSchema>;
    const trip = await createTrip(payload, ctx.state.user!.role);
    ctx.status = 201;
    ctx.body = { success: true, data: trip };
  }
);

tripRouter.post("/:id/dispatch", requireRole("dispatcher", "manager"), async (ctx) => {
  const trip = await dispatchTrip(ctx.params.id, ctx.state.user!.role);
  ctx.body = { success: true, data: trip };
});

tripRouter.post(
  "/:id/complete",
  requireRole("dispatcher", "manager"),
  validate(completeTripSchema),
  async (ctx) => {
    const payload = ctx.state.validated as z.infer<typeof completeTripSchema>;
    const data = await completeTrip(ctx.params.id, payload, ctx.state.user!.role);
    ctx.body = { success: true, data };
  }
);

tripRouter.post("/:id/cancel", requireRole("dispatcher", "manager"), async (ctx) => {
  const trip = await cancelTrip(ctx.params.id, ctx.state.user!.role);
  ctx.body = { success: true, data: trip };
});

tripRouter.post(
  "/:id/fuel-log",
  requireRole("dispatcher", "manager"),
  validate(fuelLogSchema),
  async (ctx) => {
    const payload = ctx.state.validated as z.infer<typeof fuelLogSchema>;
    const fuel = await addFuelLog(ctx.params.id, payload);
    ctx.status = 201;
    ctx.body = { success: true, data: fuel };
  }
);

export default tripRouter;
