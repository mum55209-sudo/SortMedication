// Pharmacy accounts, staff logins and sessions.

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import { newId, one, query, transaction, type Queryable } from "./db";
import { canWrite, ROLES, TRIAL_DAYS, type Role } from "./domain";
import { UserError } from "./errors";

const SESSION_DAYS = 14;
const MIN_PASSWORD = 8;

export interface Pharmacy {
  id: string;
  name: string;
  license_number: string;
  address: string;
  phone: string;
  expiry_warning_days: number;
  subscription_status: string;
  trial_ends_at: Date;
}

export interface Branch {
  id: string;
  name: string;
  address: string;
}

export interface User {
  id: string;
  pharmacy_id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
}

// Everything a page needs to know about who is logged in.
export interface Ctx {
  user: User;
  pharmacy: Pharmacy;
  branch: Branch;
  branches: Branch[];
  writable: boolean;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function checkPassword(password: string) {
  if (password.length < MIN_PASSWORD) throw new UserError(`Passwords need at least ${MIN_PASSWORD} characters.`);
}

function checkEmail(email: string) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new UserError("Please enter a valid email address.");
}

async function emailTaken(db: Queryable, email: string): Promise<boolean> {
  const rows = await db.query("SELECT 1 FROM users WHERE email = $1", [email]);
  return rows.length > 0;
}

export async function logActivity(db: Queryable, pharmacyId: string, userId: string | null, action: string, details = "") {
  await db.query("INSERT INTO activity_log (id, pharmacy_id, user_id, action, details) VALUES ($1, $2, $3, $4, $5)", [
    newId(),
    pharmacyId,
    userId,
    action,
    details,
  ]);
}

// Sign-up: creates the pharmacy, its first branch and the owner's login.
export async function createPharmacyAccount(input: {
  pharmacyName: string;
  ownerName: string;
  email: string;
  password: string;
}): Promise<{ pharmacyId: string; userId: string; branchId: string }> {
  const pharmacyName = input.pharmacyName.trim();
  const ownerName = input.ownerName.trim();
  const email = normalizeEmail(input.email);
  if (!pharmacyName) throw new UserError("Please enter the pharmacy's name.");
  if (!ownerName) throw new UserError("Please enter your name.");
  checkEmail(email);
  checkPassword(input.password);
  const passwordHash = await bcrypt.hash(input.password, 10);

  return transaction(async (tx) => {
    if (await emailTaken(tx, email)) throw new UserError("An account with that email already exists. Try logging in.");
    const pharmacyId = newId();
    const branchId = newId();
    const userId = newId();
    const trialEnds = new Date(Date.now() + TRIAL_DAYS * 86_400_000);
    await tx.query("INSERT INTO pharmacies (id, name, trial_ends_at) VALUES ($1, $2, $3)", [pharmacyId, pharmacyName, trialEnds]);
    await tx.query("INSERT INTO branches (id, pharmacy_id, name) VALUES ($1, $2, $3)", [branchId, pharmacyId, "Main store"]);
    await tx.query(
      "INSERT INTO users (id, pharmacy_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, 'owner')",
      [userId, pharmacyId, ownerName, email, passwordHash],
    );
    await logActivity(tx, pharmacyId, userId, "Account created", `${pharmacyName}, ${TRIAL_DAYS}-day free trial started`);
    return { pharmacyId, userId, branchId };
  });
}

let dummyHash: string | undefined;

// Returns the user if the email and password match an active login.
export async function verifyLogin(email: string, password: string): Promise<User> {
  const row = await one<User & { password_hash: string }>("SELECT * FROM users WHERE email = $1", [normalizeEmail(email)]);
  // Always run bcrypt so a wrong email takes as long as a wrong password.
  dummyHash ??= await bcrypt.hash("not-a-real-password", 10);
  const ok = await bcrypt.compare(password, row?.password_hash ?? dummyHash);
  if (!row || !ok || !row.active) throw new UserError("That email and password don't match. If you don't have an account yet, set one up below.");
  return row;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expires: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [hashToken(token), userId, expires]);
  return { token, expires };
}

export async function deleteSession(token: string) {
  await query("DELETE FROM sessions WHERE token_hash = $1", [hashToken(token)]);
}

export async function loadContext(token: string): Promise<Ctx | null> {
  const session = await one<{ user_id: string; branch_id: string | null }>(
    "SELECT user_id, branch_id FROM sessions WHERE token_hash = $1 AND expires_at > now()",
    [hashToken(token)],
  );
  if (!session) return null;
  const user = await one<User>("SELECT id, pharmacy_id, name, email, role, active FROM users WHERE id = $1", [session.user_id]);
  if (!user || !user.active) return null;
  return contextForUser(user, session.branch_id);
}

export async function contextForUser(user: User, branchId: string | null): Promise<Ctx> {
  const pharmacy = (await one<Pharmacy>("SELECT * FROM pharmacies WHERE id = $1", [user.pharmacy_id]))!;
  const branches = await query<Branch>("SELECT id, name, address FROM branches WHERE pharmacy_id = $1 ORDER BY created_at", [pharmacy.id]);
  const branch = branches.find((b) => b.id === branchId) ?? branches[0];
  return {
    user,
    pharmacy,
    branch,
    branches,
    writable: canWrite(pharmacy.subscription_status, new Date(pharmacy.trial_ends_at)),
  };
}

export async function setSessionBranch(token: string, ctx: Ctx, branchId: string) {
  if (!ctx.branches.some((b) => b.id === branchId)) throw new UserError("Unknown branch.");
  await query("UPDATE sessions SET branch_id = $1 WHERE token_hash = $2", [branchId, hashToken(token)]);
}

// ---------- Staff ----------

export async function listStaff(ctx: Ctx) {
  return query<User & { created_at: Date }>(
    "SELECT id, pharmacy_id, name, email, role, active, created_at FROM users WHERE pharmacy_id = $1 ORDER BY created_at",
    [ctx.pharmacy.id],
  );
}

export async function addStaff(ctx: Ctx, input: { name: string; email: string; role: string; password: string }) {
  const name = input.name.trim();
  const email = normalizeEmail(input.email);
  if (!name) throw new UserError("Please enter the staff member's name.");
  checkEmail(email);
  checkPassword(input.password);
  if (!ROLES.includes(input.role as Role)) throw new UserError("Please choose a role.");
  const passwordHash = await bcrypt.hash(input.password, 10);
  await transaction(async (tx) => {
    if (await emailTaken(tx, email)) throw new UserError("Someone already uses that email address.");
    await tx.query("INSERT INTO users (id, pharmacy_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5, $6)", [
      newId(),
      ctx.pharmacy.id,
      name,
      email,
      passwordHash,
      input.role,
    ]);
    await logActivity(tx, ctx.pharmacy.id, ctx.user.id, "Staff added", `${name} (${email}) as ${input.role}`);
  });
}

export async function updateStaff(ctx: Ctx, userId: string, input: { role: string; active: boolean }) {
  if (!ROLES.includes(input.role as Role)) throw new UserError("Please choose a role.");
  if (userId === ctx.user.id && (input.role !== "owner" || !input.active)) {
    throw new UserError("You can't remove your own owner access. Ask another owner to do it.");
  }
  await transaction(async (tx) => {
    const target = (await tx.query<User>("SELECT * FROM users WHERE id = $1 AND pharmacy_id = $2", [userId, ctx.pharmacy.id]))[0];
    if (!target) throw new UserError("Staff member not found.");
    await tx.query("UPDATE users SET role = $1, active = $2 WHERE id = $3", [input.role, input.active, userId]);
    if (!input.active) await tx.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await logActivity(tx, ctx.pharmacy.id, ctx.user.id, "Staff updated", `${target.name}: ${input.role}, ${input.active ? "active" : "login disabled"}`);
  });
}

export async function resetStaffPassword(ctx: Ctx, userId: string, password: string) {
  checkPassword(password);
  const target = await one<User>("SELECT * FROM users WHERE id = $1 AND pharmacy_id = $2", [userId, ctx.pharmacy.id]);
  if (!target) throw new UserError("Staff member not found.");
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(password, 10), userId]);
  await query("DELETE FROM sessions WHERE user_id = $1", [userId]);
  await logActivity({ query }, ctx.pharmacy.id, ctx.user.id, "Password reset", target.name);
}

export async function changeOwnPassword(ctx: Ctx, current: string, next: string) {
  await verifyLogin(ctx.user.email, current).catch(() => {
    throw new UserError("Your current password is not right.");
  });
  checkPassword(next);
  await query("UPDATE users SET password_hash = $1 WHERE id = $2", [await bcrypt.hash(next, 10), ctx.user.id]);
}

// ---------- Pharmacy settings and branches ----------

export async function updatePharmacy(
  ctx: Ctx,
  input: { name: string; license_number: string; address: string; phone: string; expiry_warning_days: number },
) {
  if (!input.name.trim()) throw new UserError("Please enter the pharmacy's name.");
  const days = Math.round(input.expiry_warning_days);
  if (!Number.isFinite(days) || days < 1 || days > 365) throw new UserError("The expiry warning must be between 1 and 365 days.");
  await query(
    "UPDATE pharmacies SET name = $1, license_number = $2, address = $3, phone = $4, expiry_warning_days = $5 WHERE id = $6",
    [input.name.trim(), input.license_number.trim(), input.address.trim(), input.phone.trim(), days, ctx.pharmacy.id],
  );
  await logActivity({ query }, ctx.pharmacy.id, ctx.user.id, "Pharmacy details updated", `Expiry warning ${days} days`);
}

export async function addBranch(ctx: Ctx, name: string, address: string) {
  if (!name.trim()) throw new UserError("Please enter the branch name.");
  await query("INSERT INTO branches (id, pharmacy_id, name, address) VALUES ($1, $2, $3, $4)", [
    newId(),
    ctx.pharmacy.id,
    name.trim(),
    address.trim(),
  ]);
  await logActivity({ query }, ctx.pharmacy.id, ctx.user.id, "Branch added", name.trim());
}

export async function renameBranch(ctx: Ctx, branchId: string, name: string, address: string) {
  if (!name.trim()) throw new UserError("Please enter the branch name.");
  await query("UPDATE branches SET name = $1, address = $2 WHERE id = $3 AND pharmacy_id = $4", [
    name.trim(),
    address.trim(),
    branchId,
    ctx.pharmacy.id,
  ]);
}

export async function listActivity(ctx: Ctx, limit = 200) {
  return query<{ id: string; action: string; details: string; created_at: Date; user_name: string | null }>(
    `SELECT a.id, a.action, a.details, a.created_at, u.name AS user_name
       FROM activity_log a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.pharmacy_id = $1 ORDER BY a.created_at DESC LIMIT $2`,
    [ctx.pharmacy.id, limit],
  );
}
