# WIDSP

A worldwide infectious disease tracking platform focused on making outbreak information easier to discover, understand, and monitor.

The project aims to bring together publicly available health and outbreak information from trusted sources into a single, accessible platform.

> **Track outbreaks. Understand trends. Stay informed.**

## About

Infectious disease outbreaks can develop across borders long before they become widely known.

WIDSP is being created to provide a centralized view of disease activity around the world, helping people explore:

- 🌍 Global disease activity
- 🦠 Infectious diseases and outbreaks
- 📍 Geographic distribution
- 📈 Disease trends over time
- 📰 Official outbreak reports
- 🕒 Historical disease activity
- 🔎 Disease and country information

The platform is intended to cover more than a single disease or pandemic. It is designed as a long-term global disease monitoring project.

## Why WIDSP Tracker?

The COVID-19 pandemic demonstrated how valuable accessible, centralized disease information can be.

However, infectious diseases did not start with COVID-19, and they will not end with it.

WIDSP aims to provide a broader platform for exploring infectious disease activity worldwide, whether that means monitoring an emerging outbreak, looking at disease trends in a particular country, or exploring how previous outbreaks developed.

## Data

WIDSP will rely on publicly available information from reputable health and epidemiological sources.

Where possible, information will include:

- The original data source
- Reporting date
- Reporting period
- Geographic scope
- Data definitions
- Last update
- Source attribution

WIDSP does **not** intend to manufacture or estimate official case counts where reliable data is unavailable.

Missing data will remain missing rather than being presented as zero.

## Scope

The platform is intended to support diseases such as:

- COVID-19
- Influenza
- Dengue
- Measles
- Cholera
- Mpox
- Ebola
- Marburg virus disease
- Malaria
- Tuberculosis
- Polio
- Yellow fever
- Chikungunya
- Zika
- Plague

This list is not exhaustive and will evolve as the project develops.

## Status

🚧 **Early development**

WIDSP is currently in its early development stage.

The project is being built incrementally, with reliability and trustworthy data taking priority over simply displaying large amounts of information.

What works today:

- Data model for diseases, countries, sources, observations (with revisions), outbreaks, reports and sync jobs.
- Three WHO sources, each with attribution, deduplication and revision history:
  - Global Health Observatory: curated annual statistics (cholera, measles, malaria, tuberculosis, polio, yellow fever, plague).
  - COVID-19 dashboard: weekly reported COVID-19 cases and deaths.
  - Disease Outbreak News: official outbreak reports since 1996, grouped into outbreak records.
- An interactive world map (`/map`): countries named in recent WHO outbreak reports pulse, faster for more recent reports, and reported statistics can be viewed by indicator and period.
- An overview page with the latest official reports, stored indicators, reporting periods and sync status.

Not yet available: disease/country/outbreak detail pages, the public API and scheduled synchronization.

## Getting started

Requirements: Node.js 20.19+ and PostgreSQL 14+.

```bash
npm install
cp .env.example .env          # set DATABASE_URL
npx prisma migrate deploy
npm run db:seed
npm run sync -- --all         # imports data from WHO GHO; takes several minutes
npm run dev
```

Run the tests with `npm test` (integration tests need `TEST_DATABASE_URL`).

## Documentation

- [Architecture](docs/architecture.md)
- [Data sources](docs/data-sources.md)
- [Methodology](docs/methodology.md)
- [Deployment](docs/deployment.md)

## Philosophy

WIDSP is built around a few simple principles:

**Data first.**  
Information should come from identifiable and reputable sources.

**Transparency.**  
Users should be able to understand where information came from and when it was reported.

**No false certainty.**  
Unavailable data should not be presented as confirmed information.

**Global by design.**  
The platform should work across countries, regions, and diseases rather than being centered around a single outbreak.

**Open and accessible.**  
Disease information should be easy for people to explore without unnecessary barriers.

## Disclaimer

WIDSP is an information and data visualization project.

It is **not a medical diagnosis tool**, does not provide medical advice, and should not be used as a substitute for guidance from qualified healthcare professionals or official public health authorities.

Reported information may be delayed, revised, incomplete, or subject to the definitions and methodologies used by its original source.

Always refer to the original source and relevant local health authorities for official guidance.

## Project

WIDSP is an independent open-source project.

---

**WIDSP**  
*Track outbreaks. Understand trends. Stay informed.*
