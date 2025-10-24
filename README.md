# UnPlotter

**Extract numerical data from vector plots in PDF files**

UnPlotter is a browser-based tool that allows you to extract data from technical plots and graphs embedded in PDF documents. Simply load a PDF, calibrate the axes, select curves, and export the data as CSV or JSON.

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/demo-live-success)](https://ramcdona.github.io/unplotter)

## Features

- **100% Browser-Based** - No server required, all processing happens locally
- **PDF Support** - Load and navigate multi-page PDF documents
- **Vector Path Extraction** - Automatically extracts vector paths from PDFs
- **Axis Calibration** - Convert page coordinates to real data values
- **Curve Labeling** - Identify extracted curves with custom labels
- **Multiple Export Formats** - Download data as CSV or JSON
- **Privacy First** - Your files never leave your browser
- **Open Source** - MIT Licensed
- **Free** - Free to use, but contributions are appreciated if you find UnPlotter useful

## Use Cases
- Extract data from research papers and technical reports
- Digitize plots from legacy documents
- Recreate datasets for analysis, visualization, comparisons, etc.
- Archive plot data in machine-readable formats

## How It Works
1. **Load PDF** - Load a PDF file containing plots or graphs
1. **Navigate** - Browse pages and zoom/rotate to view your target plot
1. **Enable Selection** - Turn on selection mode to interact with plots
1. **Calibrate Axes** - Select reference lines for X and Y axes and enter their min/max values
1. **Label Curves** - Click on curves to select them and assign meaningful labels
1. **Export Data** - Download extracted data as CSV or JSON files

## Known Limitations
- Only works with vector-based plots (not raster images)
- Requires manual axis calibration
- Requires manual curve identification and labeling
- No support for logarithmic axes or polar plots
  - Extract linear data and transform in an external tool
- Some complex PDF operations may not extract paths correctly
  - Please report any issues you encounter with sample files if you can


## Support UnPlotter

Hopefully UnPlotter saves you time or enables you to do something cool.

If you find UnPlotter useful, please consider supporting the project.

<div style="text-align:center;">
<style>.pp-KXTU4C3367A82{text-align:center;border:none;border-radius:0.25rem;min-width:11.625rem;padding:0 2rem;height:2.625rem;font-weight:bold;background-color:#FFD140;color:#000000;font-family:"Helvetica Neue",Arial,sans-serif;font-size:1rem;line-height:1.25rem;cursor:pointer;}</style>
<form action="https://www.paypal.com/ncp/payment/KXTU4C3367A82" method="post" target="_blank" style="display:inline-grid;justify-items:center;align-content:start;gap:0.5rem;">
<input class="pp-KXTU4C3367A82" type="submit" value="Tip" />
<img src=https://www.paypalobjects.com/images/Debit_Credit_APM.svg alt="cards" />
<section style="font-size: 0.75rem;"> Powered by <img src="https://www.paypalobjects.com/paypal-ui/logos/svg/paypal-wordmark-color.svg" alt="paypal" style="height:0.875rem;vertical-align:middle;"/></section>
</form>
</div>

## Development

```bash
# Clone the repository
git clone https://github.com/ramcdona/unplotter.git
cd unplotter

# Install dependencies
npm install

# Start local server
npm start
```

The app will be available at http://localhost:3000

### Project Structure

```
unplotter/
├── src/
│   ├── main.js              # Main application logic
│   ├── pdf-loader.js        # PDF loading and rendering
│   ├── path-extractor.js    # Vector path extraction
│   ├── canvas-overlay.js    # Interactive curve selection
│   ├── axis-calibrator.js   # Coordinate calibration
│   └── data-exporter.js     # CSV/JSON export
├── styles/
│   └── main.css             # Application styles
├── index.html               # Landing page
├── UnPlotter.html           # Main application
├── help.html                # Help documentation
└── package.json             # Dependencies
```

## Technology Stack
- **[PDF.js](https://github.com/mozilla/pdf.js)** - PDF rendering and path extraction
- **Vanilla JavaScript** - No heavy frameworks
- **HTML5 Canvas** - Interactive overlay for curve selection

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.

## Potential Future Development (not planned)
- Support for logarithmic, polar, and other complex plots
- Batch processing of multiple PDFs
- Automatic axis detection
- Automatic curve detection and labeling

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author
**Rob McDonald**
- GitHub: [@ramcdona](https://github.com/ramcdona)

## Support
If you encounter any issues or have questions:
- Open an [issue](https://github.com/ramcdona/unplotter/issues) on GitHub
- Check the [help page](https://ramcdona.github.io/unplotter/help.html) for documentation

** If you find this tool useful, please consider giving it a star on GitHub!**
