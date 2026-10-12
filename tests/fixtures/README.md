# Test fixtures

`gho/` contains real responses from the WHO Global Health Observatory OData API
(https://ghoapi.azureedge.net/api), trimmed to a few rows each. They were
captured on 2026-10-10 and are used so the automated test suite never depends
on live third-party services.

- `Indicator.json`: subset of `GET /api/Indicator`.
- `TB_e_inc_num.json`: estimated TB incidence, with uncertainty bounds and
  country, WHO region, income group and global rows.
- `WHS3_50.json`: reported yellow fever cases, including rows with no value
  (`NumericValue: null`), a reported zero, and a non-ISO code (`XKX`).

Source: World Health Organization, Global Health Observatory. CC BY-NC-SA 3.0 IGO.
Tests that need altered data (revisions, breakdown dimensions) derive it from
these fixtures in code, so the files themselves stay verbatim.
