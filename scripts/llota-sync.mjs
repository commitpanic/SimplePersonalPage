import { writeFile } from "node:fs/promises";

const ENDPOINT = "https://llota.app/api/public/spots";
const OUT_FILE = "data/llota.latest.json";

async function main() {
  const res = await fetch(ENDPOINT, {
    headers: {
      "User-Agent": "SP3FCK-SpotsSync/1.0",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`LLOTA HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("LLOTA unexpected payload (expected array)");
  }

  const output = `${JSON.stringify(data, null, 2)}\n`;
  await writeFile(OUT_FILE, output, "utf8");

  console.log(`Saved ${data.length} LLOTA spots to ${OUT_FILE}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
