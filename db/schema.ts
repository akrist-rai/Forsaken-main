import { sql } from "drizzle-orm";
import {
  pgEnum,
  pgTable,
  text,
  integer,
  timestamp,
  doublePrecision,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", [
  "manager",
  "dispatcher",
  "safety",
  "finance",
]);

export const vehicleTypeEnum = pgEnum("vehicle_type", ["truck", "van", "bike"]);

export const vehicleStatusEnum = pgEnum("vehicle_status", [
  "available",
  "on_trip",
  "in_shop",
  "retired",
]);

export const driverStatusEnum = pgEnum("driver_status", [
  "on_duty",
  "off_duty",
  "suspended",
]);

export const licenseCategoryEnum = pgEnum("license_category", [
  "truck",
  "van",
  "bike",
  "multi",
]);

export const tripStatusEnum = pgEnum("trip_status", [
  "draft",
  "dispatched",
  "completed",
  "cancelled",
]);

export const expenseTypeEnum = pgEnum("expense_type", ["fuel", "maintenance"]);

export const cargoStatusEnum = pgEnum("cargo_status", [
  "pending",
  "assigned",
  "completed",
  "cancelled",
]);

export const vehicles = pgTable(
  "vehicles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    model: text("model").notNull(),
    plate: text("plate").notNull(),
    vehicleType: vehicleTypeEnum("vehicle_type").notNull(),
    maxLoadKg: integer("max_load_kg").notNull(),
    odometerKm: integer("odometer_km").notNull().default(0),
    region: text("region").notNull(),
    status: vehicleStatusEnum("status").notNull().default("available"),
    acquisitionCost: doublePrecision("acquisition_cost"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("vehicles_plate_unique_idx").on(table.plate),
    index("vehicles_status_idx").on(table.status),
    index("vehicles_region_idx").on(table.region),
    check("vehicles_max_load_positive_chk", sql`${table.maxLoadKg} > 0`),
    check("vehicles_odometer_non_negative_chk", sql`${table.odometerKm} >= 0`),
  ]
);

export const drivers = pgTable(
  "drivers",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    licenseNumber: text("license_number").notNull(),
    licenseCategory: licenseCategoryEnum("license_category").notNull().default("multi"),
    licenseExpiresAt: timestamp("license_expires_at", { withTimezone: true }).notNull(),
    safetyScore: integer("safety_score").notNull().default(100),
    status: driverStatusEnum("status").notNull().default("off_duty"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("drivers_license_unique_idx").on(table.licenseNumber),
    index("drivers_status_idx").on(table.status),
    index("drivers_expiry_idx").on(table.licenseExpiresAt),
    check("drivers_safety_score_range_chk", sql`${table.safetyScore} >= 0 AND ${table.safetyScore} <= 100`),
  ]
);

export const cargoShipments = pgTable(
  "cargo_shipments",
  {
    id: text("id").primaryKey(),
    referenceCode: text("reference_code").notNull(),
    weightKg: integer("weight_kg").notNull(),
    region: text("region").notNull(),
    status: cargoStatusEnum("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("cargo_reference_unique_idx").on(table.referenceCode),
    index("cargo_status_idx").on(table.status),
    check("cargo_weight_non_negative_chk", sql`${table.weightKg} >= 0`),
  ]
);

export const trips = pgTable(
  "trips",
  {
    id: text("id").primaryKey(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    driverId: text("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "restrict" }),
    cargoId: text("cargo_id").references(() => cargoShipments.id, { onDelete: "set null" }),
    cargoWeightKg: integer("cargo_weight_kg").notNull().default(0),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    status: tripStatusEnum("status").notNull().default("draft"),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    startOdometerKm: integer("start_odometer_km"),
    endOdometerKm: integer("end_odometer_km"),
    distanceKm: integer("distance_km"),
    revenue: doublePrecision("revenue"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("trips_status_idx").on(table.status),
    index("trips_vehicle_idx").on(table.vehicleId),
    index("trips_driver_idx").on(table.driverId),
    uniqueIndex("trips_dispatched_vehicle_unique_idx")
      .on(table.vehicleId)
      .where(sql`${table.status} = 'dispatched'`),
    uniqueIndex("trips_dispatched_driver_unique_idx")
      .on(table.driverId)
      .where(sql`${table.status} = 'dispatched'`),
    check("trips_cargo_weight_non_negative_chk", sql`${table.cargoWeightKg} >= 0`),
    check(
      "trips_odometer_order_chk",
      sql`${table.endOdometerKm} IS NULL OR ${table.startOdometerKm} IS NULL OR ${table.endOdometerKm} >= ${table.startOdometerKm}`
    ),
  ]
);

export const maintenanceLogs = pgTable(
  "maintenance_logs",
  {
    id: text("id").primaryKey(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    note: text("note").notNull(),
    cost: doublePrecision("cost").notNull().default(0),
    openedAt: timestamp("opened_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    createdByRole: userRoleEnum("created_by_role").notNull(),
  },
  (table) => [
    index("maintenance_vehicle_idx").on(table.vehicleId),
    index("maintenance_open_idx").on(table.closedAt),
    check("maintenance_cost_non_negative_chk", sql`${table.cost} >= 0`),
  ]
);

export const fuelLogs = pgTable(
  "fuel_logs",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    liters: doublePrecision("liters").notNull(),
    cost: doublePrecision("cost").notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("fuel_trip_idx").on(table.tripId),
    index("fuel_vehicle_idx").on(table.vehicleId),
    check("fuel_liters_positive_chk", sql`${table.liters} > 0`),
    check("fuel_cost_non_negative_chk", sql`${table.cost} >= 0`),
  ]
);

export const expenses = pgTable(
  "expenses",
  {
    id: text("id").primaryKey(),
    type: expenseTypeEnum("type").notNull(),
    vehicleId: text("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "restrict" }),
    tripId: text("trip_id").references(() => trips.id, { onDelete: "set null" }),
    maintenanceLogId: text("maintenance_log_id").references(() => maintenanceLogs.id, {
      onDelete: "set null",
    }),
    amount: doublePrecision("amount").notNull(),
    notes: text("notes"),
    date: timestamp("date", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("expenses_vehicle_idx").on(table.vehicleId),
    index("expenses_trip_idx").on(table.tripId),
    index("expenses_type_idx").on(table.type),
    check("expenses_amount_non_negative_chk", sql`${table.amount} >= 0`),
  ]
);

export const tripEvents = pgTable(
  "trip_events",
  {
    id: text("id").primaryKey(),
    tripId: text("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    message: text("message").notNull(),
    actorRole: userRoleEnum("actor_role"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("trip_events_trip_idx").on(table.tripId)]
);
