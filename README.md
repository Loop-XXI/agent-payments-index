# Agent Payments Index

Daily snapshots of public data about paid APIs for AI agents: how many endpoints are listed, how many are actually up, and how much paid traffic is observed.

We started this because supply and demand in agent payments rarely get put side by side. The first write-up is on Stacker News: https://stacker.news/items/1594839

## What gets recorded

Once a day a GitHub Actions job runs `scripts/snapshot.mjs` and commits:

- `data/summary.csv`: one row per day with the headline numbers.
- `data/daily/YYYY-MM-DD.json`: the full snapshot for that day.

Supply comes from [402index](https://402index.io): total listed endpoints per protocol (L402, x402, MPP) and how many are healthy, degraded, down or unknown, using the public API's protocol and health filters.

Demand comes from [l402.space](https://l402.space), Alby's universal 402 proxy: transactions, volume in USD, payments received, deliveries and reliability per host, as published at `https://l402.space/api/services`.

## Caveats

- l402.space only sees traffic that goes through its proxy. Agents that pay endpoints directly are not counted, so the demand numbers are a floor, not a market size.
- Health figures are 402index's own probes. Definitions belong to 402index.
- Both sources can change their APIs or definitions. If a snapshot fails, the day is missing rather than estimated.

## Run it yourself

```
node scripts/snapshot.mjs
```

Node 20 or newer, no dependencies.

## License

Code: MIT. The data comes from the public APIs named above and belongs to their publishers; this repository records aggregate snapshots for reference.

Maintained by [Loop XXI](https://loopxxi.com). We also run Loop Gateway, an OpenAI-compatible API you can pay for in sats.
