import { db } from "./client.ts";
import { drivers, trips, vehicles } from "./schema.ts";

export async function seedIfEmpty() {
  const [vehicleCount] = await db.select().from(vehicles).limit(1);
  if (vehicleCount) return;

  await db.insert(vehicles).values([
    {
      id: "veh-001",
      name: "Van",
      model: "05",
      plate: "FF-1024",
      vehicleType: "van",
      maxLoadKg: 500,
      odometerKm: 78320,
      region: "west",
      status: "available",
      acquisitionCost: 45000,
    },
    {
      id: "veh-002",
      name: "Truck",
      model: "12",
      plate: "FF-1188",
      vehicleType: "truck",
      maxLoadKg: 3200,
      odometerKm: 121402,
      region: "west",
      status: "in_shop",
      acquisitionCost: 92000,
    },
  ]);

  await db.insert(drivers).values([
    {
      id: "drv-001",
      name: "Marcus Hill",
      licenseNumber: "CA-DL-5521",
      licenseCategory: "multi",
      licenseExpiresAt: new Date("2026-08-20T00:00:00.000Z"),
      status: "on_duty",
      safetyScore: 88,
    },
    {
      id: "drv-002",
      name: "Angela Ruiz",
      licenseNumber: "CA-DL-6710",
      licenseCategory: "van",
      licenseExpiresAt: new Date("2026-09-14T00:00:00.000Z"),
      status: "off_duty",
      safetyScore: 93,
    },
  ]);

  await db.insert(trips).values({
    id: "trp-001",
    vehicleId: "veh-001",
    driverId: "drv-001",
    cargoWeightKg: 450,
    origin: "Los Angeles, CA",
    destination: "San Diego, CA",
    scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
    status: "draft",
    updatedAt: new Date(),
  });
}
