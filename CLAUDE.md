# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AstroMosaic is a telescope observation planning tool that visualizes celestial targets and calculates telescope parameters for mosaic observations. 
It provides a JavaScript web application.

## Development Commands

No build system is configured. The project runs directly from source files.

**Web Application:**
- Open `AstroMosaic.html` directly in a browser
- Open `AstroMosaicEngineExample.html` for the embedded API example

## Architecture

### JavaScript Engine

**`AstroMosaicEngine.js`** (~2600 lines) is the main calculation engine:
- Client-side execution for web application
- Entry point: `StartAstroMosaicViewerEngine()`
- Uses Aladin Lite v3 for sky atlas visualization
- Uses Google Charts for visibility graphs

> **Note:** Python files (`AstroMosaicEngine.py`, `AstroMosaicEngineExample.py`) are outdated and should be ignored.

### Key Calculations

The JavaScript engine provides:
- Target coordinate resolution (decimal degrees, HMS/DMS, name resolution via CDS Sesame)
- Daily visibility (altitude/azimuth over night)
- Yearly visibility patterns
- Moon phase and altitude tracking
- Mosaic grid coordinate generation (up to 10x10 panels)

### External Services

- **CDS Sesame**: Target name resolution (`https://cds.unistra.fr/cgi-bin/nph-sesame`)
- **Aladin Lite**: Sky atlas visualization (`https://aladin.cds.unistra.fr/`)

### Coordinate Formats Supported

- `HH:MM:SS DD:MM:SS` or `HH MM SS DD MM SS`
- `HH:MM:SS/DD:MM:SS` or `HH MM SS/DD MM SS`
- `HHMMSS DDMMSS`
- Decimal degrees: `HH.dec DD.dec`
- Target names (resolved via Sesame)

## Key Files

| File | Purpose |
|------|---------|
| `AstroMosaic.html` | Main web application UI |
| `AstroMosaicEngine.js` | JavaScript calculation engine |
| `AstroMosaicEngineExample.html` | JavaScript embedding example |
| `tutorial-system.js` | Interactive tutorial UI |

## External Documentation

- Configuration reference: https://ruuth.xyz/AstroMosaicConfigurationInfo.html
- Embedding guide: https://ruuth.xyz/AstroMosaicInfo.html
