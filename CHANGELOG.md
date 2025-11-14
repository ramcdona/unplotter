# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) where practical.

---

## [Unreleased]

### Added
- Adaptive tessellation of PDF path curves into polylines.
- Display version number in header of app.

### Changed
- Curve handling now evaluates `C`, `V`, and `Y` path segments as full cubic Béziers instead of approximating them by endpoints.

---

## [1.0.0] - 2025-10-24

### Added
- Initial version of UnPlotter.
- Basic PDF loading and path extraction.
- Rendering overlay for drawing extracted paths on top of the PDF.
- Curve selection overlay for visual inspection and selection of paths.
- Axis calibration framework for mapping PDF coordinates to data coordinates.
- Data export functionality for extracted polyline paths.
