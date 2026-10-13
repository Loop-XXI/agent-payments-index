// Daily snapshot of public agent-payments data. No dependencies (Node 20+).
// Sources: 402index.io (supply and endpoint health) and l402.space (observed paid traffic).
import { mkdir, writeFile, readFile } from 'node:fs/promises';

const UA = { 'user-agent': 'agent-payments-index/1.0 (+https://github.com/Loop-XXI/agent-payments-index)' };

async function getJson(url, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: UA });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return await res.json();
    } catch (err) {
      last = err;
      await new Promise(r => setTimeout(r, 2000 * (i + 1)));
    }
  }
  throw last;
}

async function indexTotal(protocol, health) {
  const q = new URLSearchParams({ protocol, limit: '1' });
  if (health) q.set('health', health);
  const j = await getJson(`https://402index.io/api/v1/services?${q}`);
  if (typeof j.total !== 'number') throw new Error(`no total for ${protocol}/${health}`);
  return j.total;
}

const now = new Date();
const day = now.toISOString().slice(0, 10);

const supply = {};
for (const protocol of ['L402', 'x402', 'MPP']) {
  const row = { listed: await indexTotal(protocol) };
  for (const health of ['healthy', 'degraded', 'down', 'unknown']) row[health] = await indexTotal(protocol, health);
  supply[protocol] = row;
}

const space = await getJson('https://l402.space/api/services');
const services = (space.services || []).map(s => ({
  host: s.host,
  network: s.network,
  txCount: s.txCount ?? null,
  volumeUsd: s.volumeUsd ?? null,
  paymentsReceived: s.paymentsReceived ?? null,
  deliveries: s.deliveries ?? null,
  reliability: s.reliability ?? null,
  priceMin: s.priceMin ?? null,
  priceMax: s.priceMax ?? null,
  lastActivity: s.lastActivity ? new Date(s.lastActivity).toISOString() : null,
}));
const byNetwork = {};
for (const s of services) {
  const n = (byNetwork[s.network] ||= { services: 0, txCount: 0, volumeUsd: 0 });
  n.services += 1;
  n.txCount += s.txCount || 0;
  n.volumeUsd += s.volumeUsd || 0;
}
for (const n of Object.values(byNetwork)) n.volumeUsd = Math.round(n.volumeUsd * 100) / 100;
const demand = {
  services: services.length,
  txCount: services.reduce((a, s) => a + (s.txCount || 0), 0),
  volumeUsd: Math.round(services.reduce((a, s) => a + (s.volumeUsd || 0), 0) * 100) / 100,
  byNetwork,
};

const snapshot = {
  captured_at: now.toISOString(),
  sources: {
    supply: 'https://402index.io/api/v1/services (protocol and health filters, total field)',
    demand: 'https://l402.space/api/services (paid traffic observed through the l402.space proxy only)',
  },
  supply,
  demand,
  l402space_services: services,
};

await mkdir('data/daily', { recursive: true });
await writeFile(`data/daily/${day}.json`, JSON.stringify(snapshot, null, 2) + '\n');

const header = 'date,l402_listed,l402_healthy,l402_degraded,l402_down,x402_listed,x402_healthy,x402_degraded,x402_down,mpp_listed,mpp_healthy,mpp_degraded,mpp_down,space_services,space_tx,space_volume_usd,space_lightning_volume_usd';
const line = [
  day,
  supply.L402.listed, supply.L402.healthy, supply.L402.degraded, supply.L402.down,
  supply.x402.listed, supply.x402.healthy, supply.x402.degraded, supply.x402.down,
  supply.MPP.listed, supply.MPP.healthy, supply.MPP.degraded, supply.MPP.down,
  demand.services, demand.txCount, demand.volumeUsd, byNetwork.lightning ? byNetwork.lightning.volumeUsd : 0,
].join(',');
let csv = '';
try { csv = await readFile('data/summary.csv', 'utf8'); } catch {}
const rows = csv.split('\n').filter(l => l && l !== header && !l.startsWith(day + ','));
await writeFile('data/summary.csv', [header, ...rows, line].join('\n') + '\n');
console.log(line);
