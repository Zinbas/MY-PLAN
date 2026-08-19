import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { calendarConnections, googleOAuthStates, InsertUser, users } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

export async function createGoogleOAuthState(userId: number, stateHash: string, expiresAt: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(googleOAuthStates).values({ userId, stateHash, expiresAt });
}

export async function consumeGoogleOAuthState(stateHash: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const match = await db.select().from(googleOAuthStates).where(eq(googleOAuthStates.stateHash, stateHash)).limit(1);
  const state = match[0];
  if (!state || state.expiresAt < new Date()) return undefined;
  await db.delete(googleOAuthStates).where(and(eq(googleOAuthStates.id, state.id), eq(googleOAuthStates.stateHash, stateHash)));
  return state;
}

export async function upsertGoogleCalendarConnection(input: {
  userId: number;
  googleSubject: string;
  email: string;
  accountType: "google" | "workspace";
  scopes: string | null;
  encryptedAccessToken: string;
  encryptedRefreshToken: string | null;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(calendarConnections).values({ ...input, status: "connected" }).onDuplicateKeyUpdate({
    set: {
      googleSubject: input.googleSubject,
      accountType: input.accountType,
      status: "connected",
      scopes: input.scopes,
      encryptedAccessToken: input.encryptedAccessToken,
      encryptedRefreshToken: input.encryptedRefreshToken,
    },
  });
  const result = await db.select().from(calendarConnections).where(and(eq(calendarConnections.userId, input.userId), eq(calendarConnections.email, input.email))).limit(1);
  return result[0];
}
