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
        
        // Track scale type for each axis: 'linear' or 'log'
        this.scaleType = {
            xAxis: 'linear',
            yAxis: 'linear'
        };

        // Current page rotation (0, 90, 180, 270)
        this.rotation = 0;

        this.isCalibrated = false;
    }

    startCalibration(axis) {
        return {
            axis: axis,
            message: `Click on a line segment representing the ${axis.toUpperCase()}-axis`
        };
    }

    setRotation(rotationDegrees) {
        // Normalize to 0, 90, 180, 270
        const r = ((rotationDegrees % 360) + 360) % 360;
        this.rotation = r;
        console.log('AxisCalibrator rotation set to', this.rotation);
    }

    _mapPdfToAxisSpace(pdfX, pdfY) {
        // Map raw PDF coordinates (as used in PathExtractor) into
        // "axis space" that matches the on-screen X and Y directions
        // after rotation.
        switch (this.rotation) {
            case 90:
                // Rotate 90° CW: (x, y) -> (y, -x)
                return { x: pdfY, y: -pdfX };
            case 180:
                // 180°: (x, y) -> (-x, -y)
                return { x: -pdfX, y: -pdfY };
            case 270:
                // 270° CW (or 90° CCW): (x, y) -> (-y, x)
                return { x: -pdfY, y: pdfX };
            case 0:
            default:
                return { x: pdfX, y: pdfY };
        }
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
        // Find the minimum and maximum coordinates in axis space
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        for (const point of points) {
            const axisPoint = this._mapPdfToAxisSpace(point.x, point.y);

            if (axisPoint.x < minX) minX = axisPoint.x;
            if (axisPoint.x > maxX) maxX = axisPoint.x;
            if (axisPoint.y < minY) minY = axisPoint.y;
            if (axisPoint.y > maxY) maxY = axisPoint.y;
        }
        
        // Return as a segment-like object with min/max coordinates in axis space
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

    setScaleType(axis, type) {
        const axisKey = axis === 'x' ? 'xAxis' : 'yAxis';

        if (type !== 'linear' && type !== 'log') {
            console.error('Invalid scale type:', type);
            return;
        }

        this.scaleType[axisKey] = type;
        console.log(`Set ${axis}-axis scale type to`, type);
    }

    getScaleType(axis) {
        const axisKey = axis === 'x' ? 'xAxis' : 'yAxis';
        return this.scaleType[axisKey];
    }

    getScaleFactors() {
        if (!this.isCalibrated) {
            return null;
        }

        // Calculate scale factor for X axis using the selected segment
        const xSegment = this.calibrationSegments.xAxis;
        const xValues = this.calibrationValues.xAxis;
        
        // Segment already contains min/max values as x1/x2 in axis space
        const xPdfMin = xSegment.x1;
        const xPdfMax = xSegment.x2;
        const xPdfDistance = xPdfMax - xPdfMin;
        const xDataDistance = xValues.max - xValues.min;
        
        // Guard against zero distance
        if (xPdfDistance === 0) {
            console.error('X-axis calibration error: selected path has no horizontal extent (axis space)');
            return null;
        }
        
        const xScale = xDataDistance / xPdfDistance;
        const xOffset = xValues.min - (xPdfMin * xScale);

        // Calculate scale factor for Y axis using the selected segment
        const ySegment = this.calibrationSegments.yAxis;
        const yValues = this.calibrationValues.yAxis;
        
        // Segment already contains min/max values as y1/y2 in axis space
        const yPdfMin = ySegment.y1;
        const yPdfMax = ySegment.y2;
        const yPdfDistance = yPdfMax - yPdfMin;
        const yDataDistance = yValues.max - yValues.min;
        
        // Guard against zero distance
        if (yPdfDistance === 0) {
            console.error('Y-axis calibration error: selected path has no vertical extent (axis space)');
            return null;
        }
        
        const yScale = yDataDistance / yPdfDistance;
        const yOffset = yValues.min - (yPdfMin * yScale);

        console.log('Scale factors calculated (axis space):');
        console.log(`X: axis range [${xPdfMin.toFixed(2)}, ${xPdfMax.toFixed(2)}] -> Data range [${xValues.min}, ${xValues.max}]`);
        console.log(`Y: axis range [${yPdfMin.toFixed(2)}, ${yPdfMax.toFixed(2)}] -> Data range [${yValues.min}, ${yValues.max}]`);

        // Include axis-space min/max so log-space mapping can use them
        return {
            x: {
                scale: xScale,
                offset: xOffset,
                min: xValues.min,
                max: xValues.max,
                pdfMin: xPdfMin,
                pdfMax: xPdfMax
            },
            y: {
                scale: yScale,
                offset: yOffset,
                min: yValues.min,
                max: yValues.max,
                pdfMin: yPdfMin,
                pdfMax: yPdfMax
            }
        };
    }

    convertPoint(pdfX, pdfY) {
        const factors = this.getScaleFactors();
        if (!factors) {
            return null;
        }

        // Map raw PDF coordinates into axis space first
        const axisPoint = this._mapPdfToAxisSpace(pdfX, pdfY);
        const axisX = axisPoint.x;
        const axisY = axisPoint.y;

        const xScaleType = this.getScaleType('x');
        const yScaleType = this.getScaleType('y');

        let xValue;
        let yValue;

        // X axis conversion (axis space)
        if (xScaleType === 'log') {
            if (factors.x.min <= 0 || factors.x.max <= 0) {
                console.error('X-axis log scale requires positive min and max data values');
                return null;
            }

            const xPdfRange = factors.x.pdfMax - factors.x.pdfMin;
            if (xPdfRange === 0) {
                console.error('X-axis log scale error: axis range is zero');
                return null;
            }

            const xT = (axisX - factors.x.pdfMin) / xPdfRange;
            const xLogMin = Math.log10(factors.x.min);
            const xLogMax = Math.log10(factors.x.max);
            const xLogValue = xLogMin + xT * (xLogMax - xLogMin);
            xValue = Math.pow(10, xLogValue);
        } else {
            xValue = axisX * factors.x.scale + factors.x.offset;
        }

        // Y axis conversion (axis space)
        if (yScaleType === 'log') {
            if (factors.y.min <= 0 || factors.y.max <= 0) {
                console.error('Y-axis log scale requires positive min and max data values');
                return null;
            }

            const yPdfRange = factors.y.pdfMax - factors.y.pdfMin;
            if (yPdfRange === 0) {
                console.error('Y-axis log scale error: axis range is zero');
                return null;
            }

            const yT = (axisY - factors.y.pdfMin) / yPdfRange;
            const yLogMin = Math.log10(factors.y.min);
            const yLogMax = Math.log10(factors.y.max);
            const yLogValue = yLogMin + yT * (yLogMax - yLogMin);
            yValue = Math.pow(10, yLogValue);
        } else {
            yValue = axisY * factors.y.scale + factors.y.offset;
        }

        return {
            x: xValue,
            y: yValue
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
        
        this.scaleType = {
            xAxis: 'linear',
            yAxis: 'linear'
        };

        this.isCalibrated = false;
    }

    getCalibrationStatus() {
        return {
            isCalibrated: this.isCalibrated,
            xAxisCalibrated: this.isAxisCalibrated('x'),
            yAxisCalibrated: this.isAxisCalibrated('y'),
            segments: this.calibrationSegments,
            values: this.calibrationValues,
            scaleType: this.scaleType
        };
    }
}
