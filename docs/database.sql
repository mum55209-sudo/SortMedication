-- SortMed database. Paste all of this into Supabase's SQL Editor and click Run.
-- Made from src/lib/schema.ts; don't edit by hand.
-- Safe to run again on a database that already has some of it: steps already done are skipped.

BEGIN;

CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());

-- Step 1
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 1) THEN
    EXECUTE $step$
CREATE TABLE pharmacies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  license_number TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  expiry_warning_days INTEGER NOT NULL DEFAULT 30,
  subscription_status TEXT NOT NULL DEFAULT 'trialing',
  trial_ends_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE branches (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  branch_id TEXT REFERENCES branches(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  name TEXT NOT NULL,
  contact_name TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  account_number TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  name TEXT NOT NULL,
  strength TEXT NOT NULL DEFAULT '',
  form TEXT NOT NULL DEFAULT '',
  pack_size INTEGER NOT NULL DEFAULT 1,
  ndc TEXT NOT NULL DEFAULT '',
  barcode TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'rx',
  dea_schedule TEXT NOT NULL DEFAULT 'none',
  reorder_level INTEGER NOT NULL DEFAULT 0,
  reorder_qty INTEGER NOT NULL DEFAULT 0,
  supplier_id TEXT REFERENCES suppliers(id),
  cost_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  sell_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  storage TEXT NOT NULL DEFAULT 'room',
  location TEXT NOT NULL DEFAULT '',
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX products_branch_idx ON products (pharmacy_id, branch_id);

CREATE TABLE batches (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  lot_number TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  received_date DATE NOT NULL,
  supplier_id TEXT REFERENCES suppliers(id),
  invoice TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX batches_product_idx ON batches (product_id);

CREATE TABLE movements (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  batch_id TEXT NOT NULL REFERENCES batches(id),
  type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  reference TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX movements_batch_idx ON movements (batch_id);
CREATE INDEX movements_pharmacy_time_idx ON movements (pharmacy_id, created_at);

CREATE TABLE activity_log (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX activity_log_pharmacy_time_idx ON activity_log (pharmacy_id, created_at);
    $step$;
    INSERT INTO schema_migrations (version) VALUES (1);
  END IF;
END $do$;

-- Step 2
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 2) THEN
    EXECUTE $step$
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN google_id TEXT UNIQUE;

CREATE TABLE google_signups (
  token_hash TEXT PRIMARY KEY,
  google_id TEXT NOT NULL,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
    $step$;
    INSERT INTO schema_migrations (version) VALUES (2);
  END IF;
END $do$;

-- Step 3
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 3) THEN
    EXECUTE $step$
CREATE TABLE shipments (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  branch_id TEXT NOT NULL REFERENCES branches(id),
  supplier_id TEXT REFERENCES suppliers(id),
  reference TEXT NOT NULL DEFAULT '',
  expected_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'ordered' CHECK (status IN ('ordered', 'delayed', 'arrived', 'cancelled')),
  delay_reason TEXT NOT NULL DEFAULT '',
  arrived_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX shipments_branch_idx ON shipments (pharmacy_id, branch_id, status);

CREATE TABLE shipment_items (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  shipment_id TEXT NOT NULL REFERENCES shipments(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK (quantity > 0)
);
CREATE INDEX shipment_items_shipment_idx ON shipment_items (shipment_id);

CREATE VIEW inventory_counts WITH (security_invoker = true) AS
SELECT p.pharmacy_id, p.branch_id, p.id AS product_id, p.name, p.strength, p.form, p.ndc,
       COALESCE(SUM(m.quantity), 0)::int AS on_hand,
       p.reorder_level,
       (p.reorder_level > 0 AND COALESCE(SUM(m.quantity), 0) <= p.reorder_level) AS running_low
  FROM products p
  LEFT JOIN movements m ON m.product_id = p.id
 WHERE p.archived = false
 GROUP BY p.id;

CREATE VIEW shipment_warnings WITH (security_invoker = true) AS
SELECT s.pharmacy_id, s.branch_id, s.id AS shipment_id, s.reference, s.expected_date, s.status,
       s.delay_reason, s.arrived_at, sup.name AS supplier_name,
       CASE WHEN s.status = 'arrived' THEN 'arrived' ELSE 'delayed' END AS alert
  FROM shipments s
  LEFT JOIN suppliers sup ON sup.id = s.supplier_id
 WHERE s.status = 'delayed'
    OR (s.status = 'ordered' AND s.expected_date < CURRENT_DATE)
    OR (s.status = 'arrived' AND s.arrived_at > now() - INTERVAL '7 days');
    $step$;
    INSERT INTO schema_migrations (version) VALUES (3);
  END IF;
END $do$;

-- Step 4
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 4) THEN
    EXECUTE $step$
CREATE TABLE patients (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  allergies TEXT NOT NULL DEFAULT '',
  insurance_provider TEXT NOT NULL DEFAULT '',
  insurance_member_id TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX patients_name_idx ON patients (pharmacy_id, last_name, first_name);

ALTER TABLE movements ADD COLUMN patient_id TEXT REFERENCES patients(id);
CREATE INDEX movements_patient_idx ON movements (patient_id);
    $step$;
    INSERT INTO schema_migrations (version) VALUES (4);
  END IF;
END $do$;

-- Step 5
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 5) THEN
    EXECUTE $step$
CREATE VIEW stock_record WITH (security_invoker = true) AS
SELECT m.pharmacy_id, m.branch_id, m.product_id, p.name, p.strength, p.form, m.created_at,
       CASE WHEN m.quantity > 0 THEN 'In (+)' ELSE 'Out (-)' END AS direction,
       m.type, m.quantity,
       (SUM(m.quantity) OVER (PARTITION BY m.product_id ORDER BY m.created_at, m.id ROWS UNBOUNDED PRECEDING))::int AS in_stock_after,
       m.reference, m.note
  FROM movements m
  JOIN products p ON p.id = m.product_id;
    $step$;
    INSERT INTO schema_migrations (version) VALUES (5);
  END IF;
END $do$;

-- Step 6
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = 6) THEN
    EXECUTE $step$
ALTER TABLE patients ADD COLUMN removed BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE prescriptions (
  id TEXT PRIMARY KEY,
  pharmacy_id TEXT NOT NULL REFERENCES pharmacies(id),
  patient_id TEXT NOT NULL REFERENCES patients(id),
  product_id TEXT NOT NULL REFERENCES products(id),
  rx_number TEXT NOT NULL,
  prescriber_name TEXT NOT NULL,
  prescriber_phone TEXT NOT NULL DEFAULT '',
  directions TEXT NOT NULL DEFAULT '',
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  refills_allowed INTEGER NOT NULL DEFAULT 0 CHECK (refills_allowed >= 0),
  date_written DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled')),
  cancel_reason TEXT NOT NULL DEFAULT '',
  created_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, rx_number)
);
CREATE INDEX prescriptions_patient_idx ON prescriptions (patient_id);

ALTER TABLE movements ADD COLUMN prescription_id TEXT REFERENCES prescriptions(id);
CREATE INDEX movements_prescription_idx ON movements (prescription_id);
    $step$;
    INSERT INTO schema_migrations (version) VALUES (6);
  END IF;
END $do$;

-- Hide every table from Supabase's public Data API (the app connects directly and isn't affected).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;

COMMIT;
