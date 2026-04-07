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
        this.multiSelectMode = false;
        this.multiSelectedIndices = new Set();
        this.highlightedCurveIndices = new Set();
        this.scale = 1.0;
        this.viewport = null;
        this.rotation = 0; // Add rotation tracking

        // Raster image state
        this.images = [];          // array of image descriptors from ImageExtractor
        this.hoveredImage = null;  // image descriptor currently under cursor
        this.selectedImage = null; // image descriptor that was clicked
        this.imageMode = false;    // true → Image Export mode (images only, no curves)

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
        if (enabled) this.imageMode = false; // modes are mutually exclusive
        this._syncPointerEvents();
        this.redraw();
    }

    enableSingleSelectionMode(enabled) {
        this.selectionMode = enabled;
        if (enabled) this.imageMode = false;
        this._syncPointerEvents();
        this.redraw();
    }

    /** Image Export mode: only image bounding boxes are shown and interactive. */
    enableImageMode(enabled) {
        this.imageMode = enabled;
        if (enabled) {
            this.selectionMode = false; // modes are mutually exclusive
            this.hoveredCurve = null;
            this.selectedCurve = null;
        } else {
            this.hoveredImage = null;
            this.selectedImage = null;
        }
        this._syncPointerEvents();
        this.redraw();
    }

    _syncPointerEvents() {
        this.overlayCanvas.style.pointerEvents =
            (this.selectionMode || this.imageMode) ? 'auto' : 'none';
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
        if (!this.selectionMode && !this.imageMode) return;

        const rect = this.overlayCanvas.getBoundingClientRect();
        const scaleX = this.overlayCanvas.width / rect.width;
        const scaleY = this.overlayCanvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        if (this.imageMode) {
            // Image Export mode: only interact with images.
            const hoveredImage = this.findImageAtPoint(x, y);
            if (hoveredImage !== this.hoveredImage) {
                this.hoveredImage = hoveredImage;
                this.redraw();
            }
            return;
        }

        // Curve Selection mode: curves only, no image interaction.
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
        if (!this.selectionMode && !this.imageMode) return;

        if (this.imageMode) {
            // Image Export mode: select the hovered image.
            if (this.hoveredImage) {
                this.selectedImage = this.hoveredImage;
                this.redraw();
                this.overlayCanvas.dispatchEvent(new CustomEvent('imageSelected', {
                    detail: { image: this.hoveredImage }
                }));
            }
            return;
        }

        // Curve Selection mode: select the hovered curve.
        if (!this.hoveredCurve) return;

        if (this.multiSelectMode) {
            this.multiSelectedIndices.add(this.hoveredCurve.curveIndex);
        } else {
            this.selectedCurve = this.hoveredCurve;
        }
        this.redraw();
        this.overlayCanvas.dispatchEvent(new CustomEvent('curveSelected', {
            detail: { curve: this.hoveredCurve }
        }));
    }

    setMultiSelectMode(enabled) {
        this.multiSelectMode = enabled;
        if (!enabled) {
            this.multiSelectedIndices.clear();
        }
        this.redraw();
    }

    addMultiSelectedIndex(index) {
        this.multiSelectedIndices.add(index);
        this.redraw();
    }

    removeMultiSelectedIndex(index) {
        this.multiSelectedIndices.delete(index);
        this.redraw();
    }

    clearMultiSelection() {
        this.multiSelectedIndices.clear();
        this.redraw();
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
        this.highlightedCurveIndices = new Set([curveIndex]);
        this.redraw();
    }

    setHighlightedCurveIndices(indices) {
        this.highlightedCurveIndices = new Set(indices);
        this.redraw();
    }

    getMultiSelectedIndices() {
        return this.multiSelectedIndices;
    }

    clearHighlight() {
        this.highlightedCurveIndices.clear();
        this.redraw();
    }

    redraw() {
        this.clear();

        if (this.imageMode) {
            // Image Export mode: only image bounding boxes, no curves.
            this.drawAllImages();
            return;
        }

        if (!this.selectionMode) return;

        // Curve Selection mode: only curves, no image overlays.
        const curves = this.pathExtractor.getCurves();

        // Draw all curves
        curves.forEach((curve, index) => {
            const isSelected = !this.multiSelectMode && this.selectedCurve && this.selectedCurve.curveIndex === index;
            const isMultiSelected = this.multiSelectMode && this.multiSelectedIndices.has(index);
            const isHovered = this.hoveredCurve && this.hoveredCurve.curveIndex === index;
            const isHighlighted = this.highlightedCurveIndices.has(index);

            if (isSelected || isMultiSelected || isHighlighted) {
                this.drawCurve(curve, true);
            } else if (isHovered) {
                this.overlayContext.strokeStyle = 'rgba(255, 165, 0, 0.8)';
                this.overlayContext.lineWidth = this.highlightLineWidth;
                this.drawCurve(curve, false);
            } else {
                this.drawCurve(curve, false);
            }
        });

        // Draw endpoints for selected or highlighted curve (single-select mode only)
        const highlightedIndex = this.highlightedCurveIndices.size === 1
            ? [...this.highlightedCurveIndices][0] : null;
        const curveToMark = this.multiSelectMode ? null :
                           (this.selectedCurve ||
                           (highlightedIndex !== null ? curves[highlightedIndex] : null));
        
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
        this.hoveredCurve  = null;
        this.selectedImage = null;
        this.hoveredImage  = null;
        this.highlightedCurveIndices.clear();
        // multiSelectedIndices is managed separately via clearMultiSelection()
        this.redraw();
    }

    /** Clear image selection only (used when switching away from image mode). */
    clearImageSelection() {
        this.selectedImage = null;
        this.hoveredImage  = null;
        this.redraw();
    }

    // ── Raster image support ──────────────────────────────────────────────────

    /**
     * Provide the list of raster image descriptors extracted by ImageExtractor.
     * Each descriptor has a `bounds` property with PDF-space corner points
     * (p0, p1, p2, p3) that this overlay converts to canvas coordinates for
     * drawing and hit-testing.
     */
    setImages(images) {
        this.images = images || [];
        this.hoveredImage = null;
        this.selectedImage = null;
        this.redraw();
    }

    /**
     * Return the canvas-space corners for an image descriptor's bounding quad.
     */
    imageCanvasCorners(image) {
        const { p0, p1, p2, p3 } = image.bounds;
        return [p0, p1, p2, p3].map(p => this.transformPoint(p.x, p.y));
    }

    /**
     * True if the canvas-space point (px, py) lies inside the convex
     * quadrilateral defined by four canvas-space corners.
     * Uses consistent cross-product sign for a convex polygon.
     */
    isPointInImageQuad(px, py, corners) {
        let sign = 0;
        for (let i = 0; i < corners.length; i++) {
            const a = corners[i];
            const b = corners[(i + 1) % corners.length];
            const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
            if (cross === 0) continue;
            const s = cross > 0 ? 1 : -1;
            if (sign === 0) {
                sign = s;
            } else if (sign !== s) {
                return false;
            }
        }
        return true;
    }

    /**
     * Find which image (if any) contains canvas-space point (px, py).
     * Returns the image descriptor or null.
     */
    findImageAtPoint(px, py) {
        for (let i = this.images.length - 1; i >= 0; i--) {
            const corners = this.imageCanvasCorners(this.images[i]);
            if (this.isPointInImageQuad(px, py, corners)) {
                return { ...this.images[i], imageIndex: i };
            }
        }
        return null;
    }

    /**
     * Draw the bounding rectangle of a raster image on the overlay.
     * state: 'normal' | 'hovered' | 'selected'
     */
    drawImageRect(image, state) {
        const ctx = this.overlayContext;
        const corners = this.imageCanvasCorners(image);

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i].x, corners[i].y);
        }
        ctx.closePath();

        if (state === 'selected') {
            ctx.strokeStyle = 'rgba(255, 0, 0, 0.9)';
            ctx.fillStyle   = 'rgba(255, 0, 0, 0.08)';
            ctx.lineWidth   = this.highlightLineWidth;
        } else if (state === 'hovered') {
            ctx.strokeStyle = 'rgba(255, 165, 0, 0.9)';
            ctx.fillStyle   = 'rgba(255, 165, 0, 0.08)';
            ctx.lineWidth   = this.highlightLineWidth;
        } else {
            ctx.strokeStyle = 'rgba(0, 180, 80, 0.4)';
            ctx.fillStyle   = 'rgba(0, 180, 80, 0.04)';
            ctx.lineWidth   = this.overlayLineWidth;
        }

        ctx.setLineDash([8, 4]);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
    }

    /**
     * Draw all detected raster images on the overlay.
     */
    drawAllImages() {
        for (let i = 0; i < this.images.length; i++) {
            const img = this.images[i];
            const isSelected = this.selectedImage && this.selectedImage.imageIndex === i;
            const isHovered  = this.hoveredImage  && this.hoveredImage.imageIndex  === i;
            const state = isSelected ? 'selected' : isHovered ? 'hovered' : 'normal';
            this.drawImageRect(img, state);
        }
    }

    // ── End raster image support ──────────────────────────────────────────────

    destroy() {
        if (this.overlayCanvas && this.overlayCanvas.parentElement) {
            this.overlayCanvas.remove();
        }
    }
}
