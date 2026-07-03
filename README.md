# Chalet Financials Tracker · متتبع ماليات الشاليهات

A tiny, dependency-free tracker for vacation-rental financials pulled from the
**Gathern Business** dashboard (`business.gathern.co`). Records net sales after
Gathern's commission and commission VAT, per property, per month.

## Use it

Open **`index.html`** in any browser (double-click it — no server needed).
Filter by property and period; totals and the commission % are computed for you.

## Add a month

Every figure lives in one list. Open `index.html` in a text editor, find the
`RECORDS` array near the bottom, and add a line:

```js
{
  property: "شاليه هينار العمارية",
  periodKey: "2026-04",
  periodLabel: "أبريل 2026",
  sales: 12000.00,
  commission: 800.00,
  commissionTax: 120.00,
},
```

`net` is computed automatically (`sales − commission − commissionTax`), so you
don't enter it. Keep `data/financials.json` in sync if you use the raw data
elsewhere.

## Where the numbers come from

On the Gathern Business dashboard → **ملخص الحسابات** (Account Summary): pick the
property and period, then read **تفاصيل المبيعات** (Sales details):

| Screen field | Meaning | JSON key |
|---|---|---|
| المبيعات | Gross sales | `sales` |
| العمولة | Gathern commission | `commission` |
| ضريبة العمولة | VAT on commission (15%) | `commissionTax` |
| صافي المبيعات | Net sales (computed) | — |

## Data on file

| Property | Period | Sales | Commission | Comm. tax | Net |
|---|---|--:|--:|--:|--:|
| شاليه هينار العمارية (Hanar) | مارس 2026 | 16,173.00 | 1,071.21 | 160.68 | **14,941.11** |
