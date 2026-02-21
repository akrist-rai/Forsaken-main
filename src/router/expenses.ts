import Router from "@koa/router";
import { authenticate, requireRole } from "../middleware/index.ts";
import { listExpenses } from "../services/analyticsService.ts";

const expensesRouter = new Router({ prefix: "/api/expenses" });

expensesRouter.use(authenticate());

expensesRouter.get("/", requireRole("finance", "manager"), async (ctx) => {
  const data = await listExpenses();
  ctx.body = {
    success: true,
    count: data.items.length,
    data: data.items,
    meta: {
      totalAmount: data.total,
    },
  };
});

export default expensesRouter;
