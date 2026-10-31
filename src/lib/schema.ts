// Database tables. Each entry in MIGRATIONS runs once, in order, and is
// recorded in schema_migrations. To change the database later, add a new
// entry at the end; never edit one that has already run.
//
// Every table that holds pharmacy data has a pharmacy_id column, and every
// query filters on it, so one pharmacy can never see another's records.

export const MIGRATIONS: string[] = [
  `
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
`,
  // 2: Sign in with Google. Google users may have no password, and a Google
  // sign-up is held in google_signups until they name their pharmacy.
  `
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
`,
];
