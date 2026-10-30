// Run from frontend: node scripts/export-capacity-payloads.mjs <output-directory>
import fs from "node:fs";
import path from "node:path";
import { createServer } from "vite";

const output = path.resolve(process.argv[2] ?? "../.cache/capacity-payloads");
fs.mkdirSync(output, { recursive: true });
const vite = await createServer({ server: { middlewareMode: true } });
try {
  const { sampleDocument } = await vite.ssrLoadModule(
    "/src/features/samples/samples.ts",
  );
  const { MAX_OBJECTS, MAX_ASSOCIATIONS } = await vite.ssrLoadModule(
    "/src/domain/limits.ts",
  );
  const { assertIntegrity } = await vite.ssrLoadModule(
    "/src/domain/commands.ts",
  );
  const csv = fs.readFileSync(
    "public/samples/scenarios/full-workspace.csv",
    "utf8",
  );
  const document = sampleDocument(
    { title: "Capacity experiment", rows: 10000 },
    csv,
  );
  const write = (name, scenario) => {
    const payload = JSON.stringify({ scenario });
    fs.writeFileSync(path.join(output, `${name}.json`), payload);
    console.log(
      JSON.stringify({
        name,
        payments: scenario.payments.length,
        objects: scenario.nodes.length,
        associations: scenario.associations.length,
        requestBytes: Buffer.byteLength(payload),
      }),
    );
  };
  write("sample-10000", document.scenario);
  const maximum = structuredClone(document.scenario);
  const merchant = maximum.nodes.find((node) => node.type === "merchant");
  while (maximum.nodes.length < MAX_OBJECTS) {
    maximum.nodes.push({
      ...merchant,
      id: `capacity-merchant-${maximum.nodes.length}`,
    });
  }
  const seen = new Set(
    maximum.associations.map((a) => `${a.type}:${a.accountId}:${a.targetId}`),
  );
  const accounts = maximum.nodes.filter((node) => node.type === "account");
  const devices = maximum.nodes.filter((node) => node.type === "device");
  for (const account of accounts) {
    for (const device of devices) {
      if (maximum.associations.length === MAX_ASSOCIATIONS) break;
      const key = `accountDevice:${account.id}:${device.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      maximum.associations.push({
        id: `capacity-association-${maximum.associations.length}`,
        type: "accountDevice",
        accountId: account.id,
        targetId: device.id,
        observedAt: account.openedAt,
        knownFrom: null,
      });
    }
    if (maximum.associations.length === MAX_ASSOCIATIONS) break;
  }
  if (maximum.associations.length !== MAX_ASSOCIATIONS)
    throw new Error("Insufficient context pairs");
  assertIntegrity({
    scenario: maximum,
    view: {
      ...document.view,
      positions: Object.fromEntries(
        maximum.nodes.map((node) => [node.id, { x: 0, y: 0 }]),
      ),
    },
  });
  write("maximum-graph-10000", maximum);
} finally {
  await vite.close();
}
