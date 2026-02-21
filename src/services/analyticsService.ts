import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db/client.ts";
import { expenses, fuelLogs, maintenanceLogs, trips, vehicles } from "../db/schema.ts";

export async function getDashboardMetrics() {
  const [activeFleet] = await db
    .select({ value: sql<number>`count(*)` })
    .from(vehicles)
    .where(eq(vehicles.status, "on_trip"));

  const [maintenanceAlerts] = await db
    .select({ value: sql<number>`count(*)` })
    .from(vehicles)
    .where(eq(vehicles.status, "in_shop"));

  const [operationalFleet] = await db
    .select({ value: sql<number>`count(*)` })
    .from(vehicles)
    .where(ne(vehicles.status, "retired"));

  const [pendingCargo] = await db
    .select({ value: sql<number>`count(*)` })
    .from(trips)
    .where(and(eq(trips.status, "draft"), sql`${trips.cargoWeightKg} > 0`));

  const active = Number(activeFleet?.value ?? 0);
  const totalOperational = Number(operationalFleet?.value ?? 0);

  return {
    activeFleet: active,
    maintenanceAlerts: Number(maintenanceAlerts?.value ?? 0),
    utilizationRate: totalOperational === 0 ? 0 : Number(((active / totalOperational) * 100).toFixed(2)),
    pendingCargo: Number(pendingCargo?.value ?? 0),
  };
}

export async function getFinanceMetrics() {
  const rows = await db.execute(sql`
    with fuel as (
      select
        fl.vehicle_id,
        coalesce(sum(fl.liters), 0) as liters,
        coalesce(sum(fl.cost), 0) as fuel_cost
      from fuel_logs fl
      group by fl.vehicle_id
    ),
    maintenance as (
      select
        ml.vehicle_id,
        coalesce(sum(ml.cost), 0) as maintenance_cost
      from maintenance_logs ml
      group by ml.vehicle_id
    ),
    distance as (
      select
        t.vehicle_id,
        coalesce(sum(t.distance_km), 0) as distance_km,
        coalesce(sum(t.revenue), 0) as revenue
      from trips t
      where t.status = 'completed'
      group by t.vehicle_id
    )
    select
      v.id as vehicle_id,
      v.plate,
      v.name,
      v.model,
      v.acquisition_cost,
      coalesce(f.liters, 0) as liters,
      coalesce(f.fuel_cost, 0) as fuel_cost,
      coalesce(m.maintenance_cost, 0) as maintenance_cost,
      coalesce(d.distance_km, 0) as distance_km,
      coalesce(d.revenue, 0) as revenue
    from vehicles v
    left join fuel f on f.vehicle_id = v.id
    left join maintenance m on m.vehicle_id = v.id
    left join distance d on d.vehicle_id = v.id
    order by v.created_at desc
  `);

  const vehicleMetrics = (rows as { rows?: Array<Record<string, unknown>> }).rows ?? [];

  return vehicleMetrics.map((row) => {
    const fuelCost = Number(row.fuel_cost ?? 0);
    const maintenanceCost = Number(row.maintenance_cost ?? 0);
    const distanceKm = Number(row.distance_km ?? 0);
    const liters = Number(row.liters ?? 0);
    const revenue = Number(row.revenue ?? 0);
    const acquisitionCost = row.acquisition_cost == null ? null : Number(row.acquisition_cost);

    const totalOperationalCost = fuelCost + maintenanceCost;
    const fuelEfficiency = liters > 0 ? Number((distanceKm / liters).toFixed(4)) : null;

    const roi =
      acquisitionCost && acquisitionCost > 0
        ? Number(((revenue - totalOperationalCost) / acquisitionCost).toFixed(4))
        : null;

    return {
      vehicleId: row.vehicle_id,
      plate: row.plate,
      name: row.name,
      model: row.model,
      distanceKm,
      liters,
      fuelCost,
      maintenanceCost,
      totalOperationalCost,
      fuelEfficiencyKmPerL: fuelEfficiency,
      revenue,
      acquisitionCost,
      roi,
      roiMeta:
        roi == null
          ? "ROI unavailable until acquisitionCost is provided"
          : "ROI computed as (Revenue - (Maintenance + Fuel)) / AcquisitionCost",
    };
  });
}

export async function listExpenses() {
  const [allExpenses, total] = await Promise.all([
    db.select().from(expenses),
    db.select({ value: sql<number>`coalesce(sum(${expenses.amount}), 0)` }).from(expenses),
  ]);

  return {
    items: allExpenses,
    total: Number(total[0]?.value ?? 0),
  };
}

export async function getLegacyVehicleKpis() {
  const [totalVehicles, onTrip, inShop, odometer] = await Promise.all([
    db.select({ value: sql<number>`count(*)` }).from(vehicles),
    db.select({ value: sql<number>`count(*)` }).from(vehicles).where(eq(vehicles.status, "on_trip")),
    db.select({ value: sql<number>`count(*)` }).from(vehicles).where(eq(vehicles.status, "in_shop")),
    db.select({ value: sql<number>`coalesce(avg(${vehicles.odometerKm}), 0)` }).from(vehicles),
  ]);

  return {
    totalVehicles: Number(totalVehicles[0]?.value ?? 0),
    inShop: Number(inShop[0]?.value ?? 0),
    active: Number(onTrip[0]?.value ?? 0),
    averageMileage: Math.round(Number(odometer[0]?.value ?? 0)),
  };
}
