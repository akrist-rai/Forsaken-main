import { and, eq, isNull } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.ts";
import {
  expenses,
  maintenanceLogs,
  trips,
  vehicles,
} from "../db/schema.ts";
import { AppError } from "../middleware/01.errorHandler.ts";

type UserRole = "manager" | "dispatcher" | "safety" | "finance";

type CreateVehicleInput = {
  name: string;
  model: string;
  plate: string;
  vehicleType: "truck" | "van" | "bike";
  maxLoadKg: number;
  odometerKm: number;
  region: string;
  acquisitionCost?: number | null;
};

type AddMaintenanceInput = {
  note: string;
  cost: number;
  role: UserRole;
};

export async function listVehicles(role: UserRole) {
  const rows = await db.select().from(vehicles);
  const logs = await db.select().from(maintenanceLogs);

  const byVehicle = new Map<string, typeof logs>();
  for (const log of logs) {
    const current = byVehicle.get(log.vehicleId) ?? [];
    current.push(log);
    byVehicle.set(log.vehicleId, current);
  }

  const mapped = rows.map((vehicle) => {
    const vehicleLogs = byVehicle.get(vehicle.id) ?? [];
    const output = {
      ...vehicle,
      mileage: vehicle.odometerKm,
      unitNumber: `${vehicle.name}-${vehicle.model}`,
      maintenance: vehicleLogs,
    };

    if (role === "finance") {
      return {
        ...output,
        maintenance: undefined,
      };
    }

    return output;
  });

  return mapped;
}

export async function listInShopVehicles() {
  return db.select().from(vehicles).where(eq(vehicles.status, "in_shop"));
}

export async function createVehicle(input: CreateVehicleInput) {
  const existing = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(eq(vehicles.plate, input.plate))
    .limit(1);

  if (existing.length > 0) {
    throw new AppError(409, "Vehicle plate already exists", "PLATE_CONFLICT");
  }

  const [created] = await db
    .insert(vehicles)
    .values({
      id: `veh-${randomUUID()}`,
      name: input.name,
      model: input.model,
      plate: input.plate,
      vehicleType: input.vehicleType,
      maxLoadKg: input.maxLoadKg,
      odometerKm: input.odometerKm,
      region: input.region,
      status: "available",
      acquisitionCost: input.acquisitionCost ?? null,
    })
    .returning();

  return created;
}

export async function updateVehicleStatus(id: string, status: "available" | "on_trip" | "in_shop" | "retired") {
  const [vehicle] = await db
    .update(vehicles)
    .set({ status, updatedAt: new Date() })
    .where(eq(vehicles.id, id))
    .returning();

  if (!vehicle) {
    throw new AppError(404, "Vehicle not found", "VEHICLE_NOT_FOUND");
  }

  return vehicle;
}

export async function addMaintenance(vehicleId: string, input: AddMaintenanceInput) {
  return db.transaction(async (tx) => {
    const [vehicle] = await tx
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);

    if (!vehicle) {
      throw new AppError(404, "Vehicle not found", "VEHICLE_NOT_FOUND");
    }

    const [log] = await tx
      .insert(maintenanceLogs)
      .values({
        id: `mnt-${randomUUID()}`,
        vehicleId,
        note: input.note,
        cost: input.cost,
        createdByRole: input.role,
      })
      .returning();

    await tx
      .update(vehicles)
      .set({ status: "in_shop", updatedAt: new Date() })
      .where(eq(vehicles.id, vehicleId));

    await tx.insert(expenses).values({
      id: `exp-${randomUUID()}`,
      type: "maintenance",
      vehicleId,
      maintenanceLogId: log.id,
      amount: input.cost,
      notes: input.note,
      date: new Date(),
    });

    return log;
  });
}

export async function completeMaintenance(vehicleId: string, logId: string) {
  return db.transaction(async (tx) => {
    const [vehicle] = await tx
      .select()
      .from(vehicles)
      .where(eq(vehicles.id, vehicleId))
      .limit(1);

    if (!vehicle) {
      throw new AppError(404, "Vehicle not found", "VEHICLE_NOT_FOUND");
    }

    const [log] = await tx
      .select()
      .from(maintenanceLogs)
      .where(and(eq(maintenanceLogs.id, logId), eq(maintenanceLogs.vehicleId, vehicleId)))
      .limit(1);

    if (!log) {
      throw new AppError(404, "Maintenance log not found", "MAINT_NOT_FOUND");
    }

    if (log.closedAt) {
      throw new AppError(409, "Maintenance already completed", "MAINT_DONE");
    }

    const [closedLog] = await tx
      .update(maintenanceLogs)
      .set({ closedAt: new Date() })
      .where(eq(maintenanceLogs.id, logId))
      .returning();

    const activeTrip = await tx
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.vehicleId, vehicleId), eq(trips.status, "dispatched")))
      .limit(1);

    const openMaintenance = await tx
      .select({ id: maintenanceLogs.id })
      .from(maintenanceLogs)
      .where(and(eq(maintenanceLogs.vehicleId, vehicleId), isNull(maintenanceLogs.closedAt)))
      .limit(1);

    if (activeTrip.length === 0 && openMaintenance.length === 0 && vehicle.status !== "retired") {
      await tx
        .update(vehicles)
        .set({ status: "available", updatedAt: new Date() })
        .where(eq(vehicles.id, vehicleId));
    }

    return closedLog;
  });
}
