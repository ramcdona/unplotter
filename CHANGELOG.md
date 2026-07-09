# Changelog

All notable changes to this project will be documented in this file.

The format is inspired by [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) where practical.

---

## [1.6.0] - 2026-07-09

### Added
- Dump images at full resolution to PNG

### Fixed
- Some files with embedded images would fail to display.  Thanks spacerokk

---

## [1.5.0] - 2026-03-26

### Added
- 1:1 scale calibration mode
- Multi-select mode
- Thumbnail sidebar
- Editable page number

---

## [1.4.0] - 2026-02-19

### Added
- Improved support for rectangles as plot axes for calibration.

---

## [1.3.0] - 2026-02-19

### Fixed
- Simplify calibration workflow.  Thanks spacerokk
- Fix some UI update inconsistencies.  Thanks spacerokk
- Update README to acknowledge support of log plots.

---

## [1.2.1] - 2025-11-14

### Fixed
- Delay handling of rotated axes until after data extraction.

---

## [1.2.0] - 2025-11-14

### Added
- Support for log scale axes.

### Fixed
- Axis calibration now works with rotated PDF pages.

---

## [1.1.1] - 2025-11-14

### Fixed
- Fixed parsing two-point curveto commands in Construct Path block.

---

## [1.1.0] - 2025-11-14

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
