import { and, eq, gte, lte } from "drizzle-orm";
import { db } from "../db/client.ts";
import { drivers } from "../db/schema.ts";
import { AppError } from "../middleware/01.errorHandler.ts";

export async function listDrivers() {
  return db.select().from(drivers);
}

export async function listExpiringDrivers(days = 45) {
  const horizon = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return db
    .select()
    .from(drivers)
    .where(lte(drivers.licenseExpiresAt, horizon));
}

export async function updateDriver(
  id: string,
  patch: Partial<{
    status: "on_duty" | "off_duty" | "suspended";
    licenseExpiresAt: string;
    licenseCategory: "truck" | "van" | "bike" | "multi";
    safetyScore: number;
  }>
) {
  const setValues: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (patch.status) setValues.status = patch.status;
  if (patch.licenseExpiresAt) setValues.licenseExpiresAt = new Date(patch.licenseExpiresAt);
  if (patch.licenseCategory) setValues.licenseCategory = patch.licenseCategory;
  if (typeof patch.safetyScore === "number") setValues.safetyScore = patch.safetyScore;

  const [driver] = await db
    .update(drivers)
    .set(setValues)
    .where(eq(drivers.id, id))
    .returning();

  if (!driver) {
    throw new AppError(404, "Driver not found", "DRIVER_NOT_FOUND");
  }

  return driver;
}

export async function getDriverById(id: string) {
  const [driver] = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  if (!driver) throw new AppError(404, "Driver not found", "DRIVER_NOT_FOUND");
  return driver;
}

export async function listAssignableDrivers() {
  const now = new Date();
  return db
    .select()
    .from(drivers)
    .where(and(eq(drivers.status, "on_duty"), gte(drivers.licenseExpiresAt, now)));
}
