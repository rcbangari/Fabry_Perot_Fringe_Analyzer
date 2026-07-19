# Fabry–Pérot Fringe Analyzer

A client-side scientific web tool for extracting film thickness or real relative permittivity from adjacent Fabry–Pérot spectral fringes.

## Features

- Solve for film thickness from known permittivity.
- Solve for real relative permittivity from known thickness.
- Isotropic and birefringent analysis modes.
- Separate ordinary and extraordinary fringe families, with `εₒ`, `εₑ`, `Δn`, retardance, and O/E consistency checks.
- Wavenumber or wavelength peak entry.
- CSV/TXT spectrum import with automatic local-maximum detection.
- Oblique-incidence correction using Snell's law.
- Spacing statistics, simple uncertainty propagation, and CSV result export.
- Runs entirely in the browser; uploaded spectra are not sent to a server.

## Model

The analysis uses

```text
2 n d cos(θₜ) = m λ
```

For adjacent extrema expressed in wavenumber, the spacing is approximately

```text
Δσ = 1 / [2 n d cos(θₜ)].
```

The permittivity mode reports `εᵣ = n²`. This is a phase-index estimate under low-loss and weak-dispersion assumptions. Fringe positions alone do **not** determine complex permittivity; recovering its imaginary component requires additional intensity or phase information.

In birefringent mode, ordinary and extraordinary fringe families must be identified independently. The current oblique-incidence calculation applies Snell's law to each supplied principal phase index; it is not a full anisotropic Berreman calculation.

## Development and deployment

The analyzer is dependency-free static HTML, CSS, and JavaScript. Open `index.html` locally or serve the repository root with any static file server. GitHub Pages publishes directly from the `main` branch.

## Input format

Spectrum files should contain at least two numeric columns:

```text
wavenumber,intensity
1800,0.14
1802,0.17
...
```

The first column is interpreted according to the selected spectral unit. For overlapping birefringent branches, import or manually enter each identified family separately.

## Copyright and license

Copyright © 2026 Ramachandra Bangari. Licensed under the [MIT License](LICENSE).
