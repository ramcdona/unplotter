/**
 * UnPlotter - PDF Data Extractor
 * Copyright (c) 2025 Robert McDonald
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information.
 */

export class AxisCalibrator {
    constructor() {
        this.calibrationSegments = {
            xAxis: null,
            yAxis: null
        };
        
        this.calibrationValues = {
            xAxis: { min: null, max: null },
            yAxis: { min: null, max: null }
        };
        
        this.isCalibrated = false;
    }

    startCalibration(axis) {
        return {
            axis: axis,
            message: `Click on a line segment representing the ${axis.toUpperCase()}-axis`
        };
    }

    setCalibrationSegment(axis, segment) {
        const axisKey = axis === 'x' ? 'xAxis' : 'yAxis';
        
        // If segment is actually a curve with points array, extract min/max
        if (segment.points && segment.points.length > 0) {
            this.calibrationSegments[axisKey] = this.extractMinMaxFromPoints(segment.points);
        } else {
            // Legacy support for simple segment objects
            this.calibrationSegments[axisKey] = segment;
        }
        
        console.log(`Set ${axis}-axis segment:`, this.calibrationSegments[axisKey]);
        
        return this.isAxisCalibrated(axis);
    }
    
    extractMinMaxFromPoints(points) {
        // Find the minimum and maximum X and Y coordinates in the path
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const point of points) {
            if (point.x < minX) minX = point.x;
            if (point.x > maxX) maxX = point.x;
            if (point.y < minY) minY = point.y;
            if (point.y > maxY) maxY = point.y;
        }
        
        // Return as a segment-like object with min/max coordinates
        return {
            x1: minX,
            y1: minY,
            x2: maxX,
            y2: maxY
        };
    }

    setCalibrationValue(axis, point, value) {
        const axisKey = axis === 'x' ? 'xAxis' : 'yAxis';
        const valueKey = point === 'start' ? 'min' : 'max';
        this.calibrationValues[axisKey][valueKey] = parseFloat(value);
        
        console.log(`Set ${axis}-axis ${valueKey} value:`, value);
        
        this.checkIfFullyCalibrated();
    }

    isAxisCalibrated(axis) {
        const axisKey = axis === 'x' ? 'xAxis' : 'yAxis';
        const segment = this.calibrationSegments[axisKey];
        const values = this.calibrationValues[axisKey];
        
        return segment !== null && 
               values.min !== null && 
               values.max !== null;
    }

    checkIfFullyCalibrated() {
        this.isCalibrated = this.isAxisCalibrated('x') && this.isAxisCalibrated('y');
        return this.isCalibrated;
    }

    getScaleFactors() {
        if (!this.isCalibrated) {
            return null;
        }

        // Calculate scale factor for X axis using the selected segment
        const xSegment = this.calibrationSegments.xAxis;
        const xValues = this.calibrationValues.xAxis;
        
        // Segment already contains min/max values as x1/x2
        const xPdfMin = xSegment.x1;
        const xPdfMax = xSegment.x2;
        const xPdfDistance = xPdfMax - xPdfMin;
        const xDataDistance = xValues.max - xValues.min;
        
        // Guard against zero distance
        if (xPdfDistance === 0) {
            console.error('X-axis calibration error: selected path has no horizontal extent');
            return null;
        }
        
        const xScale = xDataDistance / xPdfDistance;
        const xOffset = xValues.min - (xPdfMin * xScale);

        // Calculate scale factor for Y axis using the selected segment
        const ySegment = this.calibrationSegments.yAxis;
        const yValues = this.calibrationValues.yAxis;
        
        // Segment already contains min/max values as y1/y2
        const yPdfMin = ySegment.y1;
        const yPdfMax = ySegment.y2;
        const yPdfDistance = yPdfMax - yPdfMin;
        const yDataDistance = yValues.max - yValues.min;
        
        // Guard against zero distance
        if (yPdfDistance === 0) {
            console.error('Y-axis calibration error: selected path has no vertical extent');
            return null;
        }
        
        const yScale = yDataDistance / yPdfDistance;
        const yOffset = yValues.min - (yPdfMin * yScale);

        console.log('Scale factors calculated:');
        console.log(`X: PDF range [${xPdfMin.toFixed(2)}, ${xPdfMax.toFixed(2)}] -> Data range [${xValues.min}, ${xValues.max}]`);
        console.log(`Y: PDF range [${yPdfMin.toFixed(2)}, ${yPdfMax.toFixed(2)}] -> Data range [${yValues.min}, ${yValues.max}]`);

        return {
            x: { scale: xScale, offset: xOffset, min: xValues.min, max: xValues.max },
            y: { scale: yScale, offset: yOffset, min: yValues.min, max: yValues.max }
        };
    }

    convertPoint(pdfX, pdfY) {
        const factors = this.getScaleFactors();
        if (!factors) {
            return null;
        }

        return {
            x: pdfX * factors.x.scale + factors.x.offset,
            y: pdfY * factors.y.scale + factors.y.offset
        };
    }

    reset() {
        this.calibrationSegments = {
            xAxis: null,
            yAxis: null
        };
        
        this.calibrationValues = {
            xAxis: { min: null, max: null },
            yAxis: { min: null, max: null }
        };
        
        this.isCalibrated = false;
    }

    getCalibrationStatus() {
        return {
            isCalibrated: this.isCalibrated,
            xAxisCalibrated: this.isAxisCalibrated('x'),
            yAxisCalibrated: this.isAxisCalibrated('y'),
            segments: this.calibrationSegments,
            values: this.calibrationValues
        };
    }
}
