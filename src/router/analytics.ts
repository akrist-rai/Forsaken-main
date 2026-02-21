import Router from "@koa/router";
import { authenticate, requireRole } from "../middleware/index.ts";
import { getDashboardMetrics, getFinanceMetrics } from "../services/analyticsService.ts";

const analyticsRouter = new Router({ prefix: "/api/analytics" });

analyticsRouter.use(authenticate());

analyticsRouter.get("/dashboard", requireRole("manager", "dispatcher", "safety", "finance"), async (ctx) => {
  const data = await getDashboardMetrics();
  ctx.body = { success: true, data };
});

analyticsRouter.get("/finance", requireRole("finance", "manager"), async (ctx) => {
  const data = await getFinanceMetrics();
  ctx.body = { success: true, count: data.length, data };
});

export default analyticsRouter;
