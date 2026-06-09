import type { Db as MongoDb } from "mongodb";

let clientPromise: Promise<MongoDb | null> | null = null;

/** Test hook — set a mock DB to bypass real MongoDB. */
export function getMockDb(): MongoDb | undefined {
  return (globalThis as Record<string, unknown>).__recingMockDb as MongoDb | undefined;
}

/** Set a mock database for testing. */
export function setTestDb(mock: MongoDb): void {
  (globalThis as Record<string, unknown>).__recingMockDb = mock;
}

/** Clear the test mock (resets to production mode). */
export function clearTestDb(): void {
  delete (globalThis as Record<string, unknown>).__recingMockDb;
}

/** Get or create the MongoDB connection. Uses mock if set. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getDb(_config: any): Promise<MongoDb> {
  const mock = getMockDb();
  if (mock) return mock;
  if (!clientPromise) {
    const { MongoClient } = await import("mongodb");
    clientPromise = new MongoClient(_config.url).connect().then((c) => c.db(_config.dbName));
  }
  return (await clientPromise)!;
}

/** Close the database connection (useful for tests / shutdown). */
export async function closeDb(): Promise<void> {
  if (clientPromise && !getMockDb()) {
    const db = await clientPromise;
    if (db) await db.client.close();
    clientPromise = null;
  }
}
