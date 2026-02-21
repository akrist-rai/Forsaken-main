CREATE TYPE "public"."cargo_status" AS ENUM('pending', 'assigned', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."driver_status" AS ENUM('on_duty', 'off_duty', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."expense_type" AS ENUM('fuel', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."license_category" AS ENUM('truck', 'van', 'bike', 'multi');--> statement-breakpoint
CREATE TYPE "public"."trip_status" AS ENUM('draft', 'dispatched', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('manager', 'dispatcher', 'safety', 'finance');--> statement-breakpoint
CREATE TYPE "public"."vehicle_status" AS ENUM('available', 'on_trip', 'in_shop', 'retired');--> statement-breakpoint
CREATE TYPE "public"."vehicle_type" AS ENUM('truck', 'van', 'bike');--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cargo_shipments" (
	"id" text PRIMARY KEY NOT NULL,
	"reference_code" text NOT NULL,
	"weight_kg" integer NOT NULL,
	"region" text NOT NULL,
	"status" "cargo_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cargo_weight_non_negative_chk" CHECK ("cargo_shipments"."weight_kg" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "drivers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"license_number" text NOT NULL,
	"license_category" "license_category" DEFAULT 'multi' NOT NULL,
	"license_expires_at" timestamp with time zone NOT NULL,
	"safety_score" integer DEFAULT 100 NOT NULL,
	"status" "driver_status" DEFAULT 'off_duty' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "drivers_safety_score_range_chk" CHECK ("drivers"."safety_score" >= 0 AND "drivers"."safety_score" <= 100)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "expense_type" NOT NULL,
	"vehicle_id" text NOT NULL,
	"trip_id" text,
	"maintenance_log_id" text,
	"amount" double precision NOT NULL,
	"notes" text,
	"date" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "expenses_amount_non_negative_chk" CHECK ("expenses"."amount" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "fuel_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"vehicle_id" text NOT NULL,
	"liters" double precision NOT NULL,
	"cost" double precision NOT NULL,
	"logged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fuel_liters_positive_chk" CHECK ("fuel_logs"."liters" > 0),
	CONSTRAINT "fuel_cost_non_negative_chk" CHECK ("fuel_logs"."cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "maintenance_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"note" text NOT NULL,
	"cost" double precision DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	"created_by_role" "user_role" NOT NULL,
	CONSTRAINT "maintenance_cost_non_negative_chk" CHECK ("maintenance_logs"."cost" >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trip_events" (
	"id" text PRIMARY KEY NOT NULL,
	"trip_id" text NOT NULL,
	"event_type" text NOT NULL,
	"message" text NOT NULL,
	"actor_role" "user_role",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "trips" (
	"id" text PRIMARY KEY NOT NULL,
	"vehicle_id" text NOT NULL,
	"driver_id" text NOT NULL,
	"cargo_id" text,
	"cargo_weight_kg" integer DEFAULT 0 NOT NULL,
	"origin" text NOT NULL,
	"destination" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" "trip_status" DEFAULT 'draft' NOT NULL,
	"dispatched_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"start_odometer_km" integer,
	"end_odometer_km" integer,
	"distance_km" integer,
	"revenue" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trips_cargo_weight_non_negative_chk" CHECK ("trips"."cargo_weight_kg" >= 0),
	CONSTRAINT "trips_odometer_order_chk" CHECK ("trips"."end_odometer_km" IS NULL OR "trips"."start_odometer_km" IS NULL OR "trips"."end_odometer_km" >= "trips"."start_odometer_km")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "vehicles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"model" text NOT NULL,
	"plate" text NOT NULL,
	"vehicle_type" "vehicle_type" NOT NULL,
	"max_load_kg" integer NOT NULL,
	"odometer_km" integer DEFAULT 0 NOT NULL,
	"region" text NOT NULL,
	"status" "vehicle_status" DEFAULT 'available' NOT NULL,
	"acquisition_cost" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vehicles_max_load_positive_chk" CHECK ("vehicles"."max_load_kg" > 0),
	CONSTRAINT "vehicles_odometer_non_negative_chk" CHECK ("vehicles"."odometer_km" >= 0)
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "expenses" ADD CONSTRAINT "expenses_maintenance_log_id_maintenance_logs_id_fk" FOREIGN KEY ("maintenance_log_id") REFERENCES "public"."maintenance_logs"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "fuel_logs" ADD CONSTRAINT "fuel_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "maintenance_logs" ADD CONSTRAINT "maintenance_logs_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trip_events" ADD CONSTRAINT "trip_events_trip_id_trips_id_fk" FOREIGN KEY ("trip_id") REFERENCES "public"."trips"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trips" ADD CONSTRAINT "trips_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trips" ADD CONSTRAINT "trips_driver_id_drivers_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."drivers"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "trips" ADD CONSTRAINT "trips_cargo_id_cargo_shipments_id_fk" FOREIGN KEY ("cargo_id") REFERENCES "public"."cargo_shipments"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "cargo_reference_unique_idx" ON "cargo_shipments" USING btree ("reference_code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "cargo_status_idx" ON "cargo_shipments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "drivers_license_unique_idx" ON "drivers" USING btree ("license_number");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drivers_status_idx" ON "drivers" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "drivers_expiry_idx" ON "drivers" USING btree ("license_expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_vehicle_idx" ON "expenses" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_trip_idx" ON "expenses" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "expenses_type_idx" ON "expenses" USING btree ("type");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fuel_trip_idx" ON "fuel_logs" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "fuel_vehicle_idx" ON "fuel_logs" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maintenance_vehicle_idx" ON "maintenance_logs" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "maintenance_open_idx" ON "maintenance_logs" USING btree ("closed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trip_events_trip_idx" ON "trip_events" USING btree ("trip_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_status_idx" ON "trips" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_vehicle_idx" ON "trips" USING btree ("vehicle_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trips_driver_idx" ON "trips" USING btree ("driver_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "vehicles_plate_unique_idx" ON "vehicles" USING btree ("plate");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_status_idx" ON "vehicles" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "vehicles_region_idx" ON "vehicles" USING btree ("region");