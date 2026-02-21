import { and, eq, isNull, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { db } from "../db/client.ts";
import {
  cargoShipments,
  drivers,
  expenses,
  fuelLogs,
  maintenanceLogs,
  trips,
  tripEvents,
  vehicles,
} from "../db/schema.ts";
import { AppError } from "../middleware/01.errorHandler.ts";

type UserRole = "manager" | "dispatcher" | "safety" | "finance";

type CreateTripInput = {
  vehicleId: string;
  driverId: string;
  cargoWeightKg: number;
  cargoId?: string | null;
  origin: string;
  destination: string;
  scheduledAt: string;
  revenue?: number | null;
};

type CompleteTripInput = {
  finalOdometerKm: number;
  fuelLiters: number;
  fuelCost: number;
  completedAt?: string;
};

type FuelLogInput = {
  liters: number;
  cost: number;
  loggedAt?: string;
};

function toLegacyStatus(status: string) {
  if (status === "draft") return "planned";
  return status;
}

function formatTripForClient<T extends { status: string }>(trip: T) {
  return {
    ...trip,
    workflowStatus: trip.status,
    status: toLegacyStatus(trip.status),
  };
}

export async function listTrips() {
  const rows = await db.select().from(trips);
  return rows.map((row) => formatTripForClient(row));
}

export async function createTrip(input: CreateTripInput, role: UserRole) {
  const [trip] = await db
    .insert(trips)
    .values({
      id: `trp-${randomUUID()}`,
      vehicleId: input.vehicleId,
      driverId: input.driverId,
      cargoWeightKg: input.cargoWeightKg,
      cargoId: input.cargoId ?? null,
      origin: input.origin,
      destination: input.destination,
      scheduledAt: new Date(input.scheduledAt),
      status: "draft",
      revenue: input.revenue ?? null,
      updatedAt: new Date(),
    })
    .returning();

  await db.insert(tripEvents).values({
    id: `evt-${randomUUID()}`,
    tripId: trip.id,
    eventType: "trip_created",
    message: "Trip created in draft state",
    actorRole: role,
  });

  return {
    ...formatTripForClient(trip),
  };
}

export async function dispatchTrip(id: string, role: UserRole) {
  return db.transaction(async (tx) => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (!trip) throw new AppError(404, "Trip not found", "TRIP_NOT_FOUND");

    if (trip.status !== "draft") {
      throw new AppError(409, "Only draft trips can be dispatched", "INVALID_TRIP_STATE");
    }

    const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, trip.vehicleId)).limit(1);
    if (!vehicle) throw new AppError(404, "Vehicle not found", "VEHICLE_NOT_FOUND");

    if (vehicle.status !== "available") {
      throw new AppError(409, "Vehicle is unavailable", "VEHICLE_UNAVAILABLE");
    }

    const [driver] = await tx.select().from(drivers).where(eq(drivers.id, trip.driverId)).limit(1);
    if (!driver) throw new AppError(404, "Driver not found", "DRIVER_NOT_FOUND");

    if (driver.status !== "on_duty") {
      throw new AppError(409, "Driver is unavailable", "DRIVER_UNAVAILABLE");
    }

    if (new Date(driver.licenseExpiresAt).getTime() < Date.now()) {
      throw new AppError(422, "Driver license expired", "LICENSE_EXPIRED");
    }

    if (driver.licenseCategory !== "multi" && driver.licenseCategory !== vehicle.vehicleType) {
      throw new AppError(422, "Driver category does not match vehicle type", "DRIVER_UNAVAILABLE");
    }

    if (trip.cargoWeightKg > vehicle.maxLoadKg) {
      throw new AppError(422, "Cargo exceeds vehicle max capacity", "CAPACITY_EXCEEDED");
    }

    const busyDriver = await tx
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.driverId, trip.driverId), eq(trips.status, "dispatched")))
      .limit(1);

    if (busyDriver.length > 0) {
      throw new AppError(409, "Driver already on dispatched trip", "DRIVER_UNAVAILABLE");
    }

    const busyVehicle = await tx
      .select({ id: trips.id })
      .from(trips)
      .where(and(eq(trips.vehicleId, trip.vehicleId), eq(trips.status, "dispatched")))
      .limit(1);

    if (busyVehicle.length > 0) {
      throw new AppError(409, "Vehicle already on dispatched trip", "VEHICLE_UNAVAILABLE");
    }

    const now = new Date();

    const [updatedTrip] = await tx
      .update(trips)
      .set({
        status: "dispatched",
        dispatchedAt: now,
        startOdometerKm: vehicle.odometerKm,
        updatedAt: now,
      })
      .where(eq(trips.id, trip.id))
      .returning();

    await tx
      .update(vehicles)
      .set({ status: "on_trip", updatedAt: now })
      .where(eq(vehicles.id, trip.vehicleId));

    if (trip.cargoId) {
      await tx
        .update(cargoShipments)
        .set({ status: "assigned" })
        .where(eq(cargoShipments.id, trip.cargoId));
    }

    await tx.insert(tripEvents).values({
      id: `evt-${randomUUID()}`,
      tripId: trip.id,
      eventType: "trip_dispatched",
      message: "Trip dispatched",
      actorRole: role,
    });

    return {
      ...formatTripForClient(updatedTrip),
    };
  });
}

export async function completeTrip(id: string, payload: CompleteTripInput, role: UserRole) {
  return db.transaction(async (tx) => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (!trip) throw new AppError(404, "Trip not found", "TRIP_NOT_FOUND");

    if (trip.status !== "dispatched") {
      throw new AppError(409, "Only dispatched trips can be completed", "INVALID_TRIP_STATE");
    }

    const [vehicle] = await tx.select().from(vehicles).where(eq(vehicles.id, trip.vehicleId)).limit(1);
    if (!vehicle) throw new AppError(404, "Vehicle not found", "VEHICLE_NOT_FOUND");

    if (trip.startOdometerKm == null) {
      throw new AppError(409, "Trip start odometer missing", "INVALID_TRIP_STATE");
    }

    if (payload.finalOdometerKm < trip.startOdometerKm) {
      throw new AppError(422, "Final odometer cannot be lower than start", "INVALID_ODOMETER");
    }

    const completedAt = payload.completedAt ? new Date(payload.completedAt) : new Date();
    const distanceKm = payload.finalOdometerKm - trip.startOdometerKm;

    const [updatedTrip] = await tx
      .update(trips)
      .set({
        status: "completed",
        completedAt,
        endOdometerKm: payload.finalOdometerKm,
        distanceKm,
        updatedAt: new Date(),
      })
      .where(eq(trips.id, trip.id))
      .returning();

    const openMaintenance = await tx
      .select({ id: maintenanceLogs.id })
      .from(maintenanceLogs)
      .where(and(eq(maintenanceLogs.vehicleId, trip.vehicleId), isNull(maintenanceLogs.closedAt)))
      .limit(1);

    const nextStatus = openMaintenance.length > 0 ? "in_shop" : "available";

    await tx
      .update(vehicles)
      .set({
        odometerKm: payload.finalOdometerKm,
        status: nextStatus,
        updatedAt: new Date(),
      })
      .where(eq(vehicles.id, trip.vehicleId));

    const [fuel] = await tx
      .insert(fuelLogs)
      .values({
        id: `fuel-${randomUUID()}`,
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        liters: payload.fuelLiters,
        cost: payload.fuelCost,
        loggedAt: completedAt,
      })
      .returning();

    await tx.insert(expenses).values({
      id: `exp-${randomUUID()}`,
      type: "fuel",
      vehicleId: trip.vehicleId,
      tripId: trip.id,
      amount: payload.fuelCost,
      notes: `Fuel log: ${payload.fuelLiters}L`,
      date: completedAt,
    });

    if (trip.cargoId) {
      await tx
        .update(cargoShipments)
        .set({ status: "completed" })
        .where(eq(cargoShipments.id, trip.cargoId));
    }

    await tx.insert(tripEvents).values({
      id: `evt-${randomUUID()}`,
      tripId: trip.id,
      eventType: "trip_completed",
      message: `Trip completed; distance ${distanceKm} km`,
      actorRole: role,
    });

    return {
      trip: {
        ...formatTripForClient(updatedTrip),
      },
      fuel,
    };
  });
}

export async function cancelTrip(id: string, role: UserRole) {
  return db.transaction(async (tx) => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (!trip) throw new AppError(404, "Trip not found", "TRIP_NOT_FOUND");

    if (trip.status === "completed") {
      throw new AppError(409, "Completed trips cannot be cancelled", "INVALID_TRIP_STATE");
    }

    if (trip.status === "cancelled") {
      throw new AppError(409, "Trip already cancelled", "INVALID_TRIP_STATE");
    }

    const now = new Date();

    const [updated] = await tx
      .update(trips)
      .set({ status: "cancelled", cancelledAt: now, updatedAt: now })
      .where(eq(trips.id, id))
      .returning();

    if (trip.status === "dispatched") {
      const openMaintenance = await tx
        .select({ id: maintenanceLogs.id })
        .from(maintenanceLogs)
        .where(and(eq(maintenanceLogs.vehicleId, trip.vehicleId), isNull(maintenanceLogs.closedAt)))
        .limit(1);

      await tx
        .update(vehicles)
        .set({ status: openMaintenance.length > 0 ? "in_shop" : "available", updatedAt: now })
        .where(eq(vehicles.id, trip.vehicleId));
    }

    if (trip.cargoId) {
      await tx
        .update(cargoShipments)
        .set({ status: "pending" })
        .where(eq(cargoShipments.id, trip.cargoId));
    }

    await tx.insert(tripEvents).values({
      id: `evt-${randomUUID()}`,
      tripId: trip.id,
      eventType: "trip_cancelled",
      message: "Trip cancelled",
      actorRole: role,
    });

    return {
      ...formatTripForClient(updated),
    };
  });
}

export async function addFuelLog(id: string, payload: FuelLogInput) {
  return db.transaction(async (tx) => {
    const [trip] = await tx.select().from(trips).where(eq(trips.id, id)).limit(1);
    if (!trip) throw new AppError(404, "Trip not found", "TRIP_NOT_FOUND");

    const when = payload.loggedAt ? new Date(payload.loggedAt) : new Date();

    const [fuel] = await tx
      .insert(fuelLogs)
      .values({
        id: `fuel-${randomUUID()}`,
        tripId: trip.id,
        vehicleId: trip.vehicleId,
        liters: payload.liters,
        cost: payload.cost,
        loggedAt: when,
      })
      .returning();

    await tx.insert(expenses).values({
      id: `exp-${randomUUID()}`,
      type: "fuel",
      vehicleId: trip.vehicleId,
      tripId: trip.id,
      amount: payload.cost,
      notes: `Fuel log: ${payload.liters}L`,
      date: when,
    });

    return fuel;
  });
}

export async function getDispatchAvailability() {
  const availableVehicles = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.status, "available"));

  const [driverPool, busyDrivers] = await Promise.all([
    db
      .select()
      .from(drivers)
      .where(sql`${drivers.status} = 'on_duty' and ${drivers.licenseExpiresAt} >= now()`),
    db
      .select({ driverId: trips.driverId })
      .from(trips)
      .where(eq(trips.status, "dispatched")),
  ]);

  const busySet = new Set(busyDrivers.map((r) => r.driverId));

  const availableDrivers = driverPool.filter((driver) => !busySet.has(driver.id));

  return {
    vehicles: availableVehicles,
    drivers: availableDrivers,
  };
}
