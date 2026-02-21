import Router from "@koa/router";
import { authenticate, requireRole } from "../middleware/index.ts";
import { getDispatchAvailability } from "../services/tripService.ts";

const dispatchRouter = new Router({ prefix: "/api/dispatch" });

dispatchRouter.use(authenticate());

dispatchRouter.get("/available", requireRole("dispatcher", "manager"), async (ctx) => {
  const data = await getDispatchAvailability();
  ctx.body = {
    success: true,
    data: {
      vehicles: data.vehicles,
      drivers: data.drivers,
    },
  };
});

export default dispatchRouter;
