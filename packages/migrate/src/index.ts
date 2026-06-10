/**
 * One-time migration: local MongoDB → Atlas cluster.
 *
 * Usage:
 *   ATLAS_MONGODB_URI="mongodb+srv://..." pnpm migrate
 *   ATLAS_MONGODB_URI="mongodb+srv://..." LOCAL_MONGODB_URI="mongodb://localhost:27017/recing" pnpm migrate --dry-run
 *
 * Environment variables:
 *   ATLAS_MONGODB_URI    — required, target Atlas connection string
 *   LOCAL_MONGODB_URI    — optional, defaults to mongodb://localhost:27017/recing
 */

import { MongoClient } from "mongodb";

const ATLAS_URI = process.env.ATLAS_MONGODB_URI ?? "";
if (!ATLAS_URI) {
  console.error("Error: set ATLAS_MONGODB_URI environment variable");
  process.exit(1);
}

const LOCAL_URI = process.env.LOCAL_MONGODB_URI ?? "mongodb://localhost:27017/recing";
const DRY_RUN = process.argv.includes("--dry-run") || process.argv.includes("-n");

// ── Helpers ────────────────────────────────────────────────────────

function formatTable(rows: { label: string; value: string }[]): void {
  const maxLabel = Math.max(...rows.map(r => r.label.length));
  console.log("┌" + "─".repeat(maxLabel + 2) + "──┬───────────────┐");
  for (const row of rows) {
    console.log(`│ ${row.label.padEnd(maxLabel)} │ ${row.value}       │`);
  }
  console.log("└" + "─".repeat(maxLabel + 2) + "──┴───────────────┘");
}

async function askConfirmation(): Promise<string> {
  const readline = await import("readline");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve): void => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rl.question("Continue? Type 'yes' to confirm: ", (answer: any) => {
      rl.close();
      resolve(answer);
    });
  });
}

// ── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  // Connect to local MongoDB
  const localClient = new MongoClient(LOCAL_URI);
  await localClient.connect();
  const localDb = localClient.db("recing");

  // Show summary from local DB
  const pipeline = [
    { $group: { _id: "$status", count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ];
  const statusStats = await localDb.collection("jobs").aggregate(pipeline).toArray();

  console.log("\n📊 Local MongoDB Summary\n");
  formatTable(
    statusStats.map(s => ({ label: String(s._id ?? "unknown"), value: String(s.count) }))
  );

  const totalLocal = await localDb.collection("jobs").countDocuments();
  console.log(`\nTotal documents to migrate: ${totalLocal}\n`);

  if (DRY_RUN) {
    console.log("🔍 Dry run — no data will be written.\n");
    return;
  }

  // Confirm with user
  const answer = await askConfirmation();
  if (answer.trim() !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  // Fetch all documents from local
  const docs = await localDb.collection("jobs").find({}).toArray();
  if (docs.length === 0) {
    console.log("No documents to migrate.");
    return;
  }

  // Mark with migration timestamp
  const now = new Date().toISOString();
  for (const doc of docs) {
    (doc as Record<string, unknown>).migratedAt = now;
  }

  // Connect to Atlas and insert
  const atlasClient = new MongoClient(ATLAS_URI);
  await atlasClient.connect();
  const atlasDb = atlasClient.db("recing");

  try {
    await atlasDb.collection("jobs").insertMany(docs);
    console.log(`\n✅ Migrated ${docs.length} documents to Atlas at ${now}\n`);
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as Record<string, number>).code === 11000) {
      console.error(
        "\n❌ Duplicate key error — Atlas collection may already have data.\n" +
        "   Consider clearing the collection or using a different target database.\n"
      );
    } else {
      throw err;
    }
  } finally {
    await atlasClient.close();
  }

  // Post-migration verification
  const atlasCount = await atlasDb.collection("jobs").countDocuments({ migratedAt: now });
  console.log(`   Verified ${atlasCount}/${docs.length} documents in Atlas with migratedAt=${now}\n`);

  await localClient.close();
}

main().catch(err => {
  console.error("\n❌ Migration failed:", err.message, "\n");
  process.exit(1);
});
