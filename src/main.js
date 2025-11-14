/**
 * UnPlotter - PDF Data Extractor
 * Copyright (c) 2025 Robert McDonald
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information.
 */

import { PDFLoader } from './pdf-loader.js';
import { PathExtractor } from './path-extractor.js';
import { CanvasOverlay } from './canvas-overlay.js';
import { AxisCalibrator } from './axis-calibrator.js';
import { DataExporter } from './data-exporter.js';

class UnPlotApp {
    constructor() {
        this.pdfLoader = new PDFLoader();
        this.pathExtractor = new PathExtractor(this.pdfLoader);
        this.canvasOverlay = null;
        this.axisCalibrator = new AxisCalibrator();
        this.dataExporter = new DataExporter();

        this.currentPageNum = 1;
        this.totalPages = 0;
        this.extractedPaths = [];
        this.selectionMode = false;
        this.calibrationMode = false;
        this.pendingCalibration = null;

        // Labeled curves management
        this.labeledCurves = [];
        this.selectedCurveForLabeling = null;

        // Resize panel
        this.isResizing = false;

        // Pan/drag scrolling
        this.isPanning = false;
        this.panStartX = 0;
        this.panStartY = 0;
        this.panScrollLeft = 0;
        this.panScrollTop = 0;

        // Initialize calibrator with current rotation (usually 0)
        this.axisCalibrator.setRotation(this.pdfLoader.getRotation());

        this.initializeUI();
    }

    initializeUI() {
        // Get DOM elements
        this.uploadBtn = document.getElementById('uploadBtn');
        this.fileInput = document.getElementById('fileInput');
        this.fileInfo = document.getElementById('fileInfo');
        this.canvas = document.getElementById('pdfCanvas');
        this.canvasContainer = document.getElementById('canvasContainer');
        this.pageNum = document.getElementById('pageNum');
        this.pageCount = document.getElementById('pageCount');

        // Navigation buttons
        this.prevPageBtn = document.getElementById('prevPage');
        this.nextPageBtn = document.getElementById('nextPage');
        this.navControls = document.getElementById('navControls');

        // Zoom buttons
        this.zoomInBtn = document.getElementById('zoomIn');
        this.zoomOutBtn = document.getElementById('zoomOut');
        this.zoomLevel = document.getElementById('zoomLevel');
        this.zoomControls = document.getElementById('zoomControls');

        // Rotation buttons
        this.rotateClockwiseBtn = document.getElementById('rotateClockwiseBtn');
        this.rotateCounterClockwiseBtn = document.getElementById('rotateCounterClockwiseBtn');
        this.rotationControls = document.getElementById('rotationControls');

        // Selection controls (now in side panel)
        this.toggleSelectionBtn = document.getElementById('toggleSelection');

        // Side panel
        this.sidePanel = document.getElementById('sidePanel');
        this.resizeHandle = document.getElementById('resizeHandle');

        // Labeling elements
        this.labelingSection = document.getElementById('labelingSection');
        this.curveLabelInput = document.getElementById('curveLabel');
        this.saveCurveLabelBtn = document.getElementById('saveCurveLabel');
        this.curveList = document.getElementById('curveList');
        this.deleteAllLabelsBtn = document.getElementById('deleteAllLabels');

        this.labelingSection.style.display = 'none';

        // Calibration elements
        this.calibrationSection = document.getElementById('calibrationSection');
        this.selectXAxisBtn = document.getElementById('selectXAxis');
        this.selectYAxisBtn = document.getElementById('selectYAxis');
        this.xMinInput = document.getElementById('xMinValue');
        this.xMaxInput = document.getElementById('xMaxValue');
        this.yMinInput = document.getElementById('yMinValue');
        this.yMaxInput = document.getElementById('yMaxValue');
        this.resetCalibrationBtn = document.getElementById('resetCalibration');
        this.calibrationStatus = document.getElementById('calibrationStatus');

        // New: log scale checkboxes
        this.xLogScaleCheckbox = document.getElementById('xLogScale');
        this.yLogScaleCheckbox = document.getElementById('yLogScale');

        // Export elements
        this.exportSection = document.getElementById('exportSection');
        this.exportCSVBtn = document.getElementById('exportCSV');
        this.exportJSONBtn = document.getElementById('exportJSON');
        this.exportPreview = document.getElementById('previewContent');

        // Event listeners
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.prevPageBtn.addEventListener('click', () => this.changePage(-1));
        this.nextPageBtn.addEventListener('click', () => this.changePage(1));
        this.zoomInBtn.addEventListener('click', () => this.changeZoom(0.25));
        this.zoomOutBtn.addEventListener('click', () => this.changeZoom(-0.25));
        this.toggleSelectionBtn.addEventListener('click', () => this.toggleSelectionMode());

        // Rotation event listeners
        this.rotateClockwiseBtn.addEventListener('click', () => this.rotateView(90));
        this.rotateCounterClockwiseBtn.addEventListener('click', () => this.rotateView(-90));

        // Resize handle
        this.resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
        document.addEventListener('mousemove', (e) => this.doResize(e));
        document.addEventListener('mouseup', () => this.stopResize());

        // Pan/drag scrolling on canvas container
        this.canvasContainer.addEventListener('mousedown', (e) => this.startPan(e));
        this.canvasContainer.addEventListener('mousemove', (e) => this.doPan(e));
        this.canvasContainer.addEventListener('mouseup', () => this.stopPan());
        this.canvasContainer.addEventListener('mouseleave', () => this.stopPan());

        // Labeling event listeners
        this.saveCurveLabelBtn.addEventListener('click', () => this.saveLabeledCurve());
        this.curveLabelInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.saveLabeledCurve();
        });
        this.deleteAllLabelsBtn.addEventListener('click', () => this.deleteAllLabels());

        // Calibration event listeners
        this.selectXAxisBtn.addEventListener('click', () => this.startAxisSelection('x'));
        this.selectYAxisBtn.addEventListener('click', () => this.startAxisSelection('y'));

        this.xMinInput.addEventListener('change', () => this.updateCalibrationValue('x', 'start'));
        this.xMaxInput.addEventListener('change', () => this.updateCalibrationValue('x', 'end'));
        this.yMinInput.addEventListener('change', () => this.updateCalibrationValue('y', 'start'));
        this.yMaxInput.addEventListener('change', () => this.updateCalibrationValue('y', 'end'));

        this.resetCalibrationBtn.addEventListener('click', () => this.resetCalibration());

        // New: log-scale change listeners
        if (this.xLogScaleCheckbox) {
            this.xLogScaleCheckbox.addEventListener('change', () => {
                this.updateScaleType('x');
            });
        }

        if (this.yLogScaleCheckbox) {
            this.yLogScaleCheckbox.addEventListener('change', () => {
                this.updateScaleType('y');
            });
        }

        // Export event listeners
        this.exportCSVBtn.addEventListener('click', () => this.exportData('csv'));
        this.exportJSONBtn.addEventListener('click', () => this.exportData('json'));

        console.log('Application initialized. Ready to load PDF.');

        // Force showing UI elements for editing.
        // this.navControls.style.display = 'block';
        // this.zoomControls.style.display = 'block';
        // this.sidePanel.style.display = 'block';
        // this.labelingSection.style.display = 'block';
        // this.calibrationSection.style.display = 'block';
        // this.exportSection.style.display = 'block';
    }

    startPan(e) {
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.panScrollLeft = this.canvasContainer.scrollLeft;
        this.panScrollTop = this.canvasContainer.scrollTop;
        this.canvasContainer.style.cursor = 'grabbing';
        e.preventDefault();
    }

    doPan(e) {
        if (!this.isPanning) return;

        const dx = e.clientX - this.panStartX;
        const dy = e.clientY - this.panStartY;

        this.canvasContainer.scrollLeft = this.panScrollLeft - dx;
        this.canvasContainer.scrollTop = this.panScrollTop - dy;
    }

    stopPan() {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvasContainer.style.cursor = '';
        }
    }

    startResize(e) {
        this.isResizing = true;
        this.resizeHandle.classList.add('dragging');
        e.preventDefault();
    }

    doResize(e) {
        if (!this.isResizing) return;

        const contentWrapper = this.sidePanel.parentElement;
        const rect = contentWrapper.getBoundingClientRect();
        const offsetRight = rect.right - e.clientX;
        const percentage = (offsetRight / rect.width) * 100;

        if (percentage >= 20 && percentage <= 50) {
            this.sidePanel.style.width = `${percentage}%`;
        }
    }

    stopResize() {
        if (this.isResizing) {
            this.isResizing = false;
            this.resizeHandle.classList.remove('dragging');
        }
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.fileInfo.textContent = `Loading: ${file.name}...`;
        console.log(`Loading PDF: ${file.name}`);

        const result = await this.pdfLoader.loadPDF(file);

        if (result.success) {
            this.totalPages = result.numPages;
            this.currentPageNum = 1;

            this.fileInfo.textContent = `${file.name}`;
            this.pageCount.textContent = this.totalPages;

            // Show controls and side panel
            this.navControls.style.display = 'flex';
            this.zoomControls.style.display = 'flex';
            this.rotationControls.style.display = 'flex';
            this.sidePanel.style.display = 'block';

            // Render first page
            await this.renderCurrentPage();

            console.log(`PDF loaded successfully: ${this.totalPages} pages`);
        } else {
            this.fileInfo.textContent = `Error: ${result.error}`;
            console.error(`Error loading PDF: ${result.error}`);
        }
    }

    async renderCurrentPage() {
        console.log(`Rendering page ${this.currentPageNum}...`);

        const result = await this.pdfLoader.renderPage(this.currentPageNum, this.canvas);

        if (result.success) {
            this.canvas.classList.add('loaded');
            this.pageNum.textContent = this.currentPageNum;
            this.updateNavigationButtons();
            console.log(`Page ${this.currentPageNum} rendered. Canvas size: ${result.width}x${result.height}px`);

            await this.extractPathsFromCurrentPage();
            this.setupCanvasOverlay(result.page);
        } else {
            console.error(`Error rendering page: ${result.error}`);
        }
    }

    async extractPathsFromCurrentPage() {
        console.log(`Extracting vector paths from page ${this.currentPageNum}...`);

        try {
            const page = this.pdfLoader.getCurrentPageObject();
            if (!page) {
                console.error('Error: No page object available');
                return;
            }

            this.extractedPaths = await this.pathExtractor.extractPaths(page);
            const curves = this.pathExtractor.getCurves();

            console.log(`✓ Extracted ${this.extractedPaths.length} paths`);
            console.log(`✓ Total curves: ${curves.length}`);

            if (curves.length > 0) {
                console.log(`✓ Sample curve: ${curves[0].points.length} points`);
            }

            console.log('Extracted paths:', this.extractedPaths);
            console.log('Curves:', curves);

        } catch (error) {
            console.error(`Error extracting paths: ${error.message}`, error);
        }
    }

    setupCanvasOverlay(page) {
        if (this.canvasOverlay) {
            this.canvasOverlay.destroy();
        }

        this.canvasOverlay = new CanvasOverlay(this.canvas, this.pathExtractor, page);
        this.canvasOverlay.setScale(this.pdfLoader.getScale());
        this.canvasOverlay.setRotation(this.pdfLoader.getRotation()); // Add rotation

        this.canvasOverlay.overlayCanvas.addEventListener('curveSelected', (e) => {
            this.handleCurveSelection(e.detail);
        });

        if (this.selectionMode) {
            this.canvasOverlay.enableSelectionMode(true);
        }
    }

    toggleSelectionMode() {
        this.selectionMode = !this.selectionMode;

        if (this.canvasOverlay) {
            this.canvasOverlay.enableSelectionMode(this.selectionMode);
        }

        if (this.selectionMode) {
            this.toggleSelectionBtn.textContent = 'Disable Selection';
            this.toggleSelectionBtn.classList.add('active');
            this.labelingSection.style.display = 'block';
            this.calibrationSection.style.display = 'block';
            console.log('Selection mode enabled - click on curves to select and label them');
        } else {
            this.toggleSelectionBtn.textContent = 'Enable Selection';
            this.toggleSelectionBtn.classList.remove('active');
            this.labelingSection.style.display = 'none';
            this.calibrationSection.style.display = 'none';
            console.log('Selection mode disabled');
        }
    }

    handleCurveSelection(detail) {
        if (this.calibrationMode && this.pendingCalibration) {
            const curve = detail.curve;
            const { axis } = this.pendingCalibration;

            if (curve.points.length >= 2) {
                // Pass the entire curve with all points to the calibrator
                // The calibrator will extract min/max coordinates from all points
                this.axisCalibrator.setCalibrationSegment(axis, curve);
                this.updateCalibrationStatus(axis, true);

                console.log(`${axis.toUpperCase()}-axis calibration path selected with ${curve.points.length} points`);
            }

            this.calibrationMode = false;
            this.pendingCalibration = null;
            this.canvas.style.cursor = 'default';

            this.removeCalibrationButtonHighlight();

            if (this.selectionMode) {
                this.canvasOverlay.enableSelectionMode(true);
            } else {
                this.canvasOverlay.enableSelectionMode(false);
            }

            this.checkCalibrationComplete();
        } else {
            this.selectedCurveForLabeling = detail.curve;
            console.log(`Selected curve with ${detail.curve.points.length} points - enter a label to save it`);
            this.curveLabelInput.focus();
        }
    }

    saveLabeledCurve() {
        if (!this.selectedCurveForLabeling) {
            console.log('No curve selected. Please click on a curve first.');
            return;
        }

        const label = this.curveLabelInput.value.trim();
        if (!label) {
            console.log('Please enter a label for the curve.');
            this.curveLabelInput.focus();
            return;
        }

        const existingIndex = this.labeledCurves.findIndex(
            lc => lc.curve.curveIndex === this.selectedCurveForLabeling.curveIndex
        );

        if (existingIndex >= 0) {
            this.labeledCurves[existingIndex].label = label;
            console.log(`Updated label for curve to "${label}"`);
        } else {
            this.labeledCurves.push({
                label: label,
                curve: this.selectedCurveForLabeling
            });
            console.log(`Saved curve with label "${label}"`);
        }

        this.curveLabelInput.value = '';
        this.canvasOverlay.clearSelection();
        this.selectedCurveForLabeling = null;

        this.updateCurveBrowser();
        this.updateExportPreview();

        // Show calibration section when first curve is labeled
        if (this.labeledCurves.length > 0) {
        }
    }

    updateCurveBrowser() {
        if (this.labeledCurves.length === 0) {
            this.curveList.innerHTML = '<li class="empty-message">No curves added yet</li>';
            return;
        }

        this.curveList.innerHTML = '';
        this.labeledCurves.forEach((labeledCurve, index) => {
            const li = document.createElement('li');
            li.className = 'curve-list-item';
            li.dataset.index = index;

            li.innerHTML = `
                <div class="curve-info">
                    <span class="curve-label">${this.escapeHtml(labeledCurve.label)}</span>
                    <span class="curve-details" style="float: right">${labeledCurve.curve.points.length} points</span>
                </div>
                <div class="curve-actions">
                    <button class="btn btn-icon btn-danger" data-action="delete" data-index="${index}">✕</button>
                </div>
            `;

            li.addEventListener('click', (e) => {
                if (e.target.dataset.action === 'delete') {
                    this.deleteLabeledCurve(index);
                } else {
                    this.highlightCurveInBrowser(index);
                }
            });

            this.curveList.appendChild(li);
        });
    }

    highlightCurveInBrowser(index) {
        document.querySelectorAll('.curve-list-item').forEach(item => {
            item.classList.remove('active');
        });

        const item = this.curveList.querySelector(`[data-index="${index}"]`);
        if (item) {
            item.classList.add('active');
        }

        const labeledCurve = this.labeledCurves[index];
        if (labeledCurve && this.canvasOverlay) {
            this.canvasOverlay.highlightCurveByIndex(labeledCurve.curve.curveIndex);
        }

    }

    deleteLabeledCurve(index) {
        const labeledCurve = this.labeledCurves[index];
        this.labeledCurves.splice(index, 1);
        console.log(`Deleted labeled curve "${labeledCurve.label}"`);
        this.updateCurveBrowser();
        this.updateExportPreview();

        if (this.canvasOverlay) {
            this.canvasOverlay.clearHighlight();
        }

        if (this.labeledCurves.length === 0) {
            this.exportSection.style.display = 'none';
        }
    }

    deleteAllLabels() {
        if (this.labeledCurves.length === 0) return;

        if (confirm(`Are you sure you want to delete all ${this.labeledCurves.length} labeled curves?`)) {
            this.labeledCurves = [];
            this.updateCurveBrowser();
            this.updateExportPreview();

            if (this.canvasOverlay) {
                this.canvasOverlay.clearHighlight();
            }
            this.exportSection.style.display = 'none';
            console.log('Cleared all labeled curves');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateExportPreview() {
        if (this.labeledCurves.length === 0 || !this.axisCalibrator.isCalibrated) {
            this.exportPreview.textContent = 'No data to preview';
            return;
        }

        try {
            this.dataExporter.prepareDataFromLabeledCurves(this.labeledCurves, this.axisCalibrator);

            const csvPreview = this.dataExporter.exportAsCSV();

            const lines = csvPreview.split('\n').slice(0, 11);
            this.exportPreview.textContent = lines.join('\n');
        } catch (error) {
            this.exportPreview.textContent = `Error: ${error.message}`;
        }
    }

    exportData(type) {
        if (this.labeledCurves.length === 0) {
            console.log('No labeled curves to export');
            return;
        }

        if (!this.axisCalibrator.isCalibrated) {
            console.log('Calibration required before export');
            return;
        }

        try {
            this.dataExporter.prepareDataFromLabeledCurves(this.labeledCurves, this.axisCalibrator);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
            const filename = `extracted_data_${timestamp}`;

            if (type === 'csv') {
                this.dataExporter.downloadCSV(`${filename}.csv`);
                console.log(`Exported ${this.labeledCurves.length} labeled curves as CSV`);
            } else if (type === 'json') {
                this.dataExporter.downloadJSON(`${filename}.json`);
                console.log(`Exported ${this.labeledCurves.length} labeled curves as JSON`);
            }
        } catch (error) {
            console.error(`Export error: ${error.message}`, error);
        }
    }

    startAxisSelection(axis) {
        this.calibrationMode = true;
        this.pendingCalibration = { axis };

        const info = this.axisCalibrator.startCalibration(axis);
        console.log(info.message);

        this.highlightCalibrationButton(axis);

        if (this.canvasOverlay) {
            this.canvasOverlay.enableSingleSelectionMode(true);
        }

        this.canvas.style.cursor = 'crosshair';
    }

    updateCalibrationValue(axis, point) {
        const input = axis === 'x' ?
            (point === 'start' ? this.xMinInput : this.xMaxInput) :
            (point === 'start' ? this.yMinInput : this.yMaxInput);

        const value = parseFloat(input.value);

        if (!isNaN(value)) {
            this.axisCalibrator.setCalibrationValue(axis, point, value);
            this.checkCalibrationComplete();
        }
    }

    checkCalibrationComplete() {
        const status = this.axisCalibrator.getCalibrationStatus();

        if (status.isCalibrated) {
            this.calibrationStatus.innerHTML = '<span class="status-text success">✅ Calibration Complete!</span>';
            console.log('Calibration complete! You can now export data.');

            this.exportSection.style.display = 'block';
            this.updateExportPreview();
        } else {
            const xStatus = status.xAxisCalibrated ? '✅' : '⏳';
            const yStatus = status.yAxisCalibrated ? '✅' : '⏳';
            this.calibrationStatus.innerHTML = `<span class="status-text">X-axis: ${xStatus} | Y-axis: ${yStatus}</span>`;
        }
    }

    updateCalibrationStatus(axis, isSet) {
        const statusId = axis === 'x' ? 'xAxisStatus' : 'yAxisStatus';

        const statusElement = document.getElementById(statusId);
        if (statusElement) {
            statusElement.textContent = isSet ? '✓' : '○';
            statusElement.style.color = isSet ? '#4CAF50' : '#999';
        }
    }

    highlightCalibrationButton(axis) {
        this.removeCalibrationButtonHighlight();

        const buttonId = axis === 'x' ? 'selectXAxis' : 'selectYAxis';

        const button = document.getElementById(buttonId);
        if (button) {
            button.classList.add('active-calibration');
        }
    }

    removeCalibrationButtonHighlight() {
        document.querySelectorAll('.btn-calibrate').forEach(btn => {
            btn.classList.remove('active-calibration');
        });
    }

    updateScaleType(axis) {
        let checkbox;
        if (axis === 'x') {
            checkbox = this.xLogScaleCheckbox;
        } else {
            checkbox = this.yLogScaleCheckbox;
        }

        if (!checkbox) {
            return;
        }

        const isLog = checkbox.checked;
        if (isLog) {
            this.axisCalibrator.setScaleType(axis, 'log');
        } else {
            this.axisCalibrator.setScaleType(axis, 'linear');
        }

        // If already calibrated and curves exist, update export preview
        if (this.axisCalibrator.isCalibrated && this.labeledCurves.length > 0) {
            this.updateExportPreview();
        }
    }

    resetCalibration() {
        this.axisCalibrator.reset();

        this.xMinInput.value = '';
        this.xMaxInput.value = '';
        this.yMinInput.value = '';
        this.yMaxInput.value = '';

        if (this.xLogScaleCheckbox) {
            this.xLogScaleCheckbox.checked = false;
        }
        if (this.yLogScaleCheckbox) {
            this.yLogScaleCheckbox.checked = false;
        }

        ['xAxisStatus', 'yAxisStatus'].forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = '○';
                element.style.color = '#999';
            }
        });

        this.calibrationStatus.innerHTML = '<span class="status-text">Not calibrated</span>';
        this.exportSection.style.display = 'none';

        console.log('Calibration reset');
    }

    async changePage(delta) {
        const newPage = this.currentPageNum + delta;

        if (newPage < 1 || newPage > this.totalPages) {
            return;
        }

        this.currentPageNum = newPage;

        if (this.selectionMode) {
            this.toggleSelectionMode();
        }

        await this.renderCurrentPage();
    }

    async changeZoom(delta) {
        const currentScale = this.pdfLoader.getScale();
        const newScale = Math.max(0.1, Math.min(10.0, currentScale + delta));

        this.pdfLoader.setScale(newScale);
        this.zoomLevel.textContent = `${Math.round(newScale * 100)}%`;

        await this.renderCurrentPage();
        console.log(`Zoom changed to ${Math.round(newScale * 100)}%`);
    }

    async rotateView(degrees) {
        if (!this.pdfLoader.pdfDocument) {
            return;
        }

        // Update rotation
        if (degrees > 0) {
            this.pdfLoader.rotateClockwise();
        } else {
            this.pdfLoader.rotateCounterClockwise();
        }

        const rotation = this.pdfLoader.getRotation();
        console.log(`Rotating view to ${rotation}°`);

        // Inform calibrator about new rotation so axis space matches screen
        this.axisCalibrator.setRotation(rotation);

        // Re-render the current page with new rotation
        await this.renderCurrentPage();

        // Update overlay with new rotation
        if (this.canvasOverlay) {
            this.canvasOverlay.setRotation(rotation);
            this.canvasOverlay.resize();

            // Re-extract paths with new rotation
            await this.extractPathsFromCurrentPage();

            // If in selection mode, redraw curves
            if (this.selectionMode) {
                this.canvasOverlay.clearSelection();
                this.canvasOverlay.drawAllCurves();
            }
        }

        console.log(`View rotated to ${rotation}°`);
    }

    updateNavigationButtons() {
        this.prevPageBtn.disabled = this.currentPageNum <= 1;
        this.nextPageBtn.disabled = this.currentPageNum >= this.totalPages;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    const app = new UnPlotApp();
    console.log('UnPlot application initialized');
});
