/**
 * UnPlotter - PDF Data Extractor
 * Copyright (c) 2025 Robert McDonald
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information.
 */

export class DataExporter {
    constructor() {
        this.labeledCurves = [];
    }

    prepareDataFromLabeledCurves(labeledCurves, calibrator) {
        if (!calibrator.isCalibrated) {
            throw new Error('Calibrator must be calibrated before exporting data');
        }

        this.labeledCurves = [];
        
        labeledCurves.forEach(({ label, curve }) => {
            const convertedPoints = [];
            
            curve.points.forEach(point => {
                const converted = calibrator.convertPoint(point.x, point.y);
                if (converted) {
                    convertedPoints.push({
                        x: converted.x,
                        y: converted.y
                    });
                }
            });

            if (convertedPoints.length > 0) {
                this.labeledCurves.push({
                    label: label,
                    points: convertedPoints,
                    curveIndex: curve.curveIndex
                });
            }
        });

        return this.labeledCurves;
    }

    exportAsCSV() {
        let csvContent = 'Label, X, Y\n';
        
        this.labeledCurves.forEach(labeledCurve => {
            labeledCurve.points.forEach((point) => {
                csvContent += `${labeledCurve.label}, ${point.x}, ${point.y}\n`;
            });
            csvContent += '\n';
        });

        return csvContent;
    }

    exportAsJSON() {
        return JSON.stringify(this.labeledCurves, null, 2);
    }

    downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 100);
    }

    downloadCSV(filename = 'extracted_data.csv') {
        const csv = this.exportAsCSV();
        this.downloadFile(csv, filename, 'text/csv');
    }

    downloadJSON(filename = 'extracted_data.json') {
        const json = this.exportAsJSON();
        this.downloadFile(json, filename, 'application/json');
    }
}
