/**
 * UnPlotter - PDF Data Extractor
 * Copyright (c) 2025 Robert McDonald
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information.
 */

export class CanvasOverlay {
    constructor(canvas, pathExtractor, page) {
        this.baseCanvas = canvas;
        this.pathExtractor = pathExtractor;
        this.page = page;
        this.overlayCanvas = null;
        this.overlayContext = null;
        this.selectedCurve = null;
        this.hoveredCurve = null;
        this.selectionMode = false;
        this.highlightedCurveIndex = null;
        this.scale = 1.0;
        this.viewport = null;
        this.rotation = 0; // Add rotation tracking

        this.overlayLineWidth = 5;
        this.highlightLineWidth = 7.5;
        this.highlightPointRadius = 10;

        this.setupOverlay();
    }

    // ... existing setupOverlay, resize, setScale, setPage, transformPoint methods ...

    setupOverlay() {
        // Create overlay canvas
        this.overlayCanvas = document.createElement('canvas');
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.top = '0';
        this.overlayCanvas.style.left = '0';
        this.overlayCanvas.style.pointerEvents = 'auto';
        this.overlayCanvas.style.cursor = 'crosshair';

        this.overlayContext = this.overlayCanvas.getContext('2d');

        // Position overlay on top of PDF canvas
        const container = this.baseCanvas.parentElement;
        const canvasWrapper = document.createElement('div');
        canvasWrapper.style.position = 'relative';
        canvasWrapper.style.display = 'inline-block';

        container.insertBefore(canvasWrapper, this.baseCanvas);
        canvasWrapper.appendChild(this.baseCanvas);
        canvasWrapper.appendChild(this.overlayCanvas);


        // Match overlay size to base canvas
        this.resize();

        // Add event listeners
        this.overlayCanvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.overlayCanvas.addEventListener('click', (e) => this.handleClick());
    }

    resize() {
        this.overlayCanvas.width = this.baseCanvas.width;
        this.overlayCanvas.height = this.baseCanvas.height;
        this.overlayCanvas.style.width = this.baseCanvas.style.width;
        this.overlayCanvas.style.height = this.baseCanvas.style.height;
    }

    setScale(scale) {
        this.scale = scale;
        if (this.page) {
            this.viewport = this.page.getViewport({ 
                scale: this.scale,
                rotation: this.rotation 
            });
            console.log('Viewport set:', this.viewport.transform);
        }
    }

    setRotation(rotation) {
        this.rotation = rotation;
        if (this.page) {
            this.viewport = this.page.getViewport({ 
                scale: this.scale,
                rotation: this.rotation 
            });
        }
    }

    transformPoint(pdfX, pdfY) {
        if (!this.viewport) {
            console.warn('No viewport available for transformation');
            return { x: pdfX, y: pdfY };
        }

        const transform = this.viewport.transform;
        const x = transform[0] * pdfX + transform[2] * pdfY + transform[4];
        const y = transform[1] * pdfX + transform[3] * pdfY + transform[5];

        return { x, y };
    }

    enableSelectionMode(enabled) {
        this.selectionMode = enabled;
        this.overlayCanvas.style.pointerEvents = enabled ? 'auto' : 'none';

        if (enabled) {
            this.drawAllCurves();
        } else {
            this.clear();
        }
    }

    enableSingleSelectionMode(enabled) {
        this.selectionMode = enabled;
        this.overlayCanvas.style.pointerEvents = enabled ? 'auto' : 'none';

        if (enabled) {
            this.drawAllCurves();
        } else {
            this.clear();
        }
    }

    drawAllCurves() {
        this.clear();
        const curves = this.pathExtractor.getCurves();

        this.overlayContext.strokeStyle = 'rgba(0, 120, 255, 0.3)';
        this.overlayContext.lineWidth = this.overlayLineWidth;

        curves.forEach((curve) => {
            this.drawCurve(curve, false);
        });
    }

    drawCurve(curve, highlight = false) {
        const ctx = this.overlayContext;

        if (curve.points.length < 2) return;

        ctx.save();

        if (highlight) {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.8)';
            ctx.lineWidth = this.highlightLineWidth;
        } else {
            ctx.strokeStyle = 'rgba(0, 120, 255, 0.3)';
            ctx.lineWidth = this.overlayLineWidth;
        }

        ctx.beginPath();
        
        const firstPoint = this.transformPoint(curve.points[0].x, curve.points[0].y);
        ctx.moveTo(firstPoint.x, firstPoint.y);

        for (let i = 1; i < curve.points.length; i++) {
            const point = this.transformPoint(curve.points[i].x, curve.points[i].y);
            ctx.lineTo(point.x, point.y);
        }

        ctx.stroke();
        ctx.restore();
    }

    handleMouseMove(e) {
        if (!this.selectionMode) return;

        const rect = this.overlayCanvas.getBoundingClientRect();
        const scaleX = this.overlayCanvas.width / rect.width;
        const scaleY = this.overlayCanvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const curves = this.pathExtractor.getCurves();
        const threshold = 25;

        let nearestCurve = null;
        let minDistance = threshold;

        curves.forEach((curve, index) => {
            const distance = this.distanceToCurve(x, y, curve);
            if (distance < minDistance) {
                minDistance = distance;
                nearestCurve = { ...curve, curveIndex: index };
            }
        });

        if (nearestCurve !== this.hoveredCurve) {
            this.hoveredCurve = nearestCurve;
            this.redraw();
        }
    }

    handleClick() {
        if (!this.selectionMode || !this.hoveredCurve) return;

        // Always single selection
        this.selectedCurve = this.hoveredCurve;

        this.redraw();

        // Dispatch custom event
        const event = new CustomEvent('curveSelected', {
            detail: {
                curve: this.selectedCurve
            }
        });
        this.overlayCanvas.dispatchEvent(event);
    }

    distanceToCurve(px, py, curve) {
        if (curve.points.length < 2) return Infinity;

        let minDistance = Infinity;

        for (let i = 0; i < curve.points.length - 1; i++) {
            const p1 = this.transformPoint(curve.points[i].x, curve.points[i].y);
            const p2 = this.transformPoint(curve.points[i + 1].x, curve.points[i + 1].y);

            const segment = {
                x1: p1.x,
                y1: p1.y,
                x2: p2.x,
                y2: p2.y
            };

            const distance = this.distanceToSegment(px, py, segment);
            minDistance = Math.min(minDistance, distance);
        }

        return minDistance;
    }

    distanceToSegment(px, py, segment) {
        const { x1, y1, x2, y2 } = segment;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
        }

        let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const projX = x1 + t * dx;
        const projY = y1 + t * dy;

        return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
    }

    highlightCurveByIndex(curveIndex) {
        this.highlightedCurveIndex = curveIndex;
        this.redraw();
    }

    clearHighlight() {
        this.highlightedCurveIndex = null;
        this.redraw();
    }

    redraw() {
        this.clear();

        if (!this.selectionMode) return;

        const curves = this.pathExtractor.getCurves();

        // Draw all curves
        curves.forEach((curve, index) => {
            const isSelected = this.selectedCurve && this.selectedCurve.curveIndex === index;
            const isHovered = this.hoveredCurve && this.hoveredCurve.curveIndex === index;
            const isHighlighted = this.highlightedCurveIndex === index;

            if (isSelected || isHighlighted) {
                this.drawCurve(curve, true);
            } else if (isHovered) {
                this.overlayContext.strokeStyle = 'rgba(255, 165, 0, 0.8)';
                this.overlayContext.lineWidth = this.highlightLineWidth;
                this.drawCurve(curve, false);
            } else {
                this.drawCurve(curve, false);
            }
        });

        // Draw endpoints for selected or highlighted curve
        const curveToMark = this.selectedCurve || 
                           (this.highlightedCurveIndex !== null ? curves[this.highlightedCurveIndex] : null);
        
        if (curveToMark && curveToMark.points && curveToMark.points.length > 0) {
            this.overlayContext.fillStyle = 'rgba(255, 0, 0, 0.8)';
            const first = this.transformPoint(curveToMark.points[0].x, curveToMark.points[0].y);
            this.drawPoint(first.x, first.y, this.highlightPointRadius);
            
            const last = this.transformPoint(
                curveToMark.points[curveToMark.points.length - 1].x,
                curveToMark.points[curveToMark.points.length - 1].y
            );
            this.drawPoint(last.x, last.y, this.highlightPointRadius);
        }
    }

    drawPoint(x, y, radius) {
        this.overlayContext.beginPath();
        this.overlayContext.arc(x, y, radius, 0, 2 * Math.PI);
        this.overlayContext.fill();
    }

    clear() {
        this.overlayContext.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
    }

    clearSelection() {
        this.selectedCurve = null;
        this.hoveredCurve = null;
        this.highlightedCurveIndex = null;
        this.redraw();
    }

    destroy() {
        if (this.overlayCanvas && this.overlayCanvas.parentElement) {
            this.overlayCanvas.remove();
        }
    }
}
