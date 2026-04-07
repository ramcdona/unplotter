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
import { ImageExtractor } from './image-extractor.js';

class UnPlotApp {
    constructor() {
        this.pdfLoader = new PDFLoader();
        this.pathExtractor = new PathExtractor(this.pdfLoader);
        this.imageExtractor = new ImageExtractor(this.pdfLoader);
        this.canvasOverlay = null;
        this.axisCalibrator = new AxisCalibrator();
        this.dataExporter = new DataExporter();
        this.selectedImage = null; // currently selected raster image for export

        this.currentPageNum = 1;
        this.totalPages = 0;
        this.extractedPaths = [];
        this.selectionMode = false;
        this.imageExportMode = false;
        this.calibrationMode = false;
        this.pendingCalibration = null;

        // 1:1 scale calibration state
        this.equalScaleMode = false;
        this.equalScaleAxis = 'x';      // which axis provides the scale
        this.perpOriginMode = 'auto';   // 'auto' | 'select'
        this.perpRefCurve = null;       // separately-clicked perp reference curve

        // Labeled curves management
        this.labeledCurves = [];
        this.selectedCurveForLabeling = null;
        this.multiSelectMode = false;

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

        // Thumbnail sidebar
        this.thumbnailSidebar = document.getElementById('thumbnailSidebar');
        this.thumbnailResizeHandle = document.getElementById('thumbnailResizeHandle');
        this.thumbnailToggleBtn = document.getElementById('thumbnailToggle');
        this.thumbnailObserver = null;
        this.isThumbnailResizing = false;

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

        // Mode controls (top of side panel)
        this.toggleSelectionBtn   = document.getElementById('toggleSelection');
        this.toggleImageExportBtn = document.getElementById('toggleImageExport');

        // Side panel
        this.sidePanel = document.getElementById('sidePanel');
        this.resizeHandle = document.getElementById('resizeHandle');

        // Labeling elements
        this.labelingSection = document.getElementById('labelingSection');
        this.labelingInstruction = document.getElementById('labelingInstruction');
        this.multiSelectCheckbox = document.getElementById('multiSelectMode');
        this.curveLabelInput = document.getElementById('curveLabel');
        this.saveCurveLabelBtn = document.getElementById('saveCurveLabel');
        this.curveList = document.getElementById('curveList');
        this.deleteAllLabelsBtn = document.getElementById('deleteAllLabels');

        this.labelingSection.style.display = 'none';

        // Calibration elements
        this.calibrationSection = document.getElementById('calibrationSection');
        this.startCalibrationBtn = document.getElementById('startCalibration');
        this.calibrationPrompt = document.getElementById('calibrationPrompt');
        this.xMinInput = document.getElementById('xMinValue');
        this.xMaxInput = document.getElementById('xMaxValue');
        this.yMinInput = document.getElementById('yMinValue');
        this.yMaxInput = document.getElementById('yMaxValue');
        this.resetCalibrationBtn = document.getElementById('resetCalibration');
        this.calibrationStatus = document.getElementById('calibrationStatus');

        // Log scale checkboxes
        this.xLogScaleCheckbox = document.getElementById('xLogScale');
        this.yLogScaleCheckbox = document.getElementById('yLogScale');

        // Calibration mode selector
        this.calModeIndependentRadio = document.getElementById('calModeIndependent');
        this.calModeEqualScaleRadio  = document.getElementById('calModeEqualScale');
        this.independentCalPanel     = document.getElementById('independentCalPanel');
        this.equalScalePanel         = document.getElementById('equalScalePanel');

        // 1:1 scale controls
        this.scaleFromXRadio         = document.getElementById('scaleFromX');
        this.scaleFromYRadio         = document.getElementById('scaleFromY');
        this.selectScaleRefBtn       = document.getElementById('selectScaleRefBtn');
        this.equalScaleAxisLabelEl   = document.getElementById('equalScaleAxisLabel');
        this.equalScaleAxisStatus    = document.getElementById('equalScaleAxisStatus');
        this.equalScaleMinInput      = document.getElementById('equalScaleMin');
        this.equalScaleMaxInput      = document.getElementById('equalScaleMax');
        this.perpOriginHeaderEl      = document.getElementById('perpOriginHeader');
        this.perpOriginAutoRadio     = document.getElementById('perpOriginAuto');
        this.perpOriginSelectRadio   = document.getElementById('perpOriginSelect');
        this.perpAutoAxisLabelEl     = document.getElementById('perpAutoAxisLabel');
        this.perpDataValueInput      = document.getElementById('perpDataValue');
        this.perpSelectControls      = document.getElementById('perpSelectControls');
        this.selectPerpRefBtn        = document.getElementById('selectPerpRefBtn');
        this.perpRefStatus           = document.getElementById('perpRefStatus');
        this.perpSelectAxisLabelEl   = document.getElementById('perpSelectAxisLabel');
        this.perpRefDataValueInput   = document.getElementById('perpRefDataValue');

        // Raster images elements
        this.imagesSection  = document.getElementById('imagesSection');
        this.imageList      = document.getElementById('imageList');
        this.saveImageBtn   = document.getElementById('saveImagePNG');

        // Export elements
        this.exportSection = document.getElementById('exportSection');
        this.exportCSVBtn = document.getElementById('exportCSV');
        this.exportJSONBtn = document.getElementById('exportJSON');
        this.exportPreview = document.getElementById('previewContent');

        // Event listeners
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
        this.thumbnailToggleBtn.addEventListener('click', () => this.toggleThumbnailSidebar());
        this.prevPageBtn.addEventListener('click', () => this.changePage(-1));
        this.nextPageBtn.addEventListener('click', () => this.changePage(1));
        this.pageNum.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { this.jumpToPage(); this.pageNum.blur(); }
            else if (e.key === 'Escape') { this.pageNum.value = this.currentPageNum; this.pageNum.blur(); }
        });
        this.pageNum.addEventListener('blur', () => this.jumpToPage());
        this.zoomInBtn.addEventListener('click', () => this.changeZoom(0.25));
        this.zoomOutBtn.addEventListener('click', () => this.changeZoom(-0.25));
        this.toggleSelectionBtn.addEventListener('click', () => this.toggleSelectionMode());
        if (this.toggleImageExportBtn) {
            this.toggleImageExportBtn.addEventListener('click', () => this.toggleImageExportMode());
        }

        // Rotation event listeners
        this.rotateClockwiseBtn.addEventListener('click', () => this.rotateView(90));
        this.rotateCounterClockwiseBtn.addEventListener('click', () => this.rotateView(-90));

        // Right-panel resize handle
        this.resizeHandle.addEventListener('mousedown', (e) => this.startResize(e));
        document.addEventListener('mousemove', (e) => this.doResize(e));
        document.addEventListener('mouseup', () => this.stopResize());

        // Thumbnail sidebar resize handle
        this.thumbnailResizeHandle.addEventListener('mousedown', (e) => this.startThumbnailResize(e));
        document.addEventListener('mousemove', (e) => this.doThumbnailResize(e));
        document.addEventListener('mouseup', () => this.stopThumbnailResize());

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
        if (this.multiSelectCheckbox) {
            this.multiSelectCheckbox.addEventListener('change', () => this.toggleMultiSelectMode());
        }

        // Calibration event listeners (independent mode only — equal-scale has its own buttons)
        this.startCalibrationBtn.addEventListener('click', () => this.startSequentialCalibration());

        // Independent-mode value inputs
        this.xMinInput.addEventListener('change', () => this.updateCalibrationValue('x', 'start'));
        this.xMaxInput.addEventListener('change', () => this.updateCalibrationValue('x', 'end'));
        this.yMinInput.addEventListener('change', () => this.updateCalibrationValue('y', 'start'));
        this.yMaxInput.addEventListener('change', () => this.updateCalibrationValue('y', 'end'));

        this.resetCalibrationBtn.addEventListener('click', () => this.resetCalibration());

        // Mode toggle
        this.calModeIndependentRadio.addEventListener('change', () => this.toggleCalibrationMode(false));
        this.calModeEqualScaleRadio.addEventListener('change',  () => this.toggleCalibrationMode(true));

        // 1:1 scale axis choice
        this.scaleFromXRadio.addEventListener('change', () => this.updateEqualScaleAxisChoice('x'));
        this.scaleFromYRadio.addEventListener('change', () => this.updateEqualScaleAxisChoice('y'));

        // 1:1 scale step buttons
        this.selectScaleRefBtn.addEventListener('click', () => this.startEqualScaleCalibration());
        this.selectPerpRefBtn.addEventListener('click',  () => this.startPerpRefSelection());

        // 1:1 scale value inputs
        this.equalScaleMinInput.addEventListener('change', () => this.updateEqualScaleCalibration());
        this.equalScaleMaxInput.addEventListener('change', () => this.updateEqualScaleCalibration());

        // Perpendicular origin
        this.perpOriginAutoRadio.addEventListener('change',   () => this.updatePerpOriginMode('auto'));
        this.perpOriginSelectRadio.addEventListener('change', () => this.updatePerpOriginMode('select'));
        this.perpDataValueInput.addEventListener('change',    () => this.updateEqualScaleCalibration());
        this.perpRefDataValueInput.addEventListener('change', () => this.updateEqualScaleCalibration());

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

        // Raster image event listeners
        if (this.saveImageBtn) {
            this.saveImageBtn.addEventListener('click', () => this.saveSelectedImageAsPNG());
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

    startThumbnailResize(e) {
        this.isThumbnailResizing = true;
        this.thumbnailResizeHandle.classList.add('dragging');
        e.preventDefault();
    }

    doThumbnailResize(e) {
        if (!this.isThumbnailResizing) return;
        const contentWrapper = this.thumbnailSidebar.parentElement;
        const newWidth = e.clientX - contentWrapper.getBoundingClientRect().left;
        if (newWidth >= 80 && newWidth <= 400) {
            this.thumbnailSidebar.style.width = newWidth + 'px';
            this.thumbnailSidebar.style.minWidth = newWidth + 'px';
        }
    }

    stopThumbnailResize() {
        if (this.isThumbnailResizing) {
            this.isThumbnailResizing = false;
            this.thumbnailResizeHandle.classList.remove('dragging');
            this.resizeThumbnails();
        }
    }

    resizeThumbnails() {
        const scrollTop = this.thumbnailSidebar.scrollTop;
        this.generateThumbnails();
        this.thumbnailSidebar.scrollTop = scrollTop;
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
            this.thumbnailToggleBtn.style.display = 'inline-flex';
            this.thumbnailSidebar.style.display = 'flex';
            this.thumbnailResizeHandle.style.display = 'block';
            this.navControls.style.display = 'flex';
            this.zoomControls.style.display = 'flex';
            this.rotationControls.style.display = 'flex';
            this.sidePanel.style.display = 'block';

            // Render first page, then populate thumbnails
            await this.renderCurrentPage();
            this.generateThumbnails();

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
            this.pageNum.value = this.currentPageNum;
            this.updateNavigationButtons();
            console.log(`Page ${this.currentPageNum} rendered. Canvas size: ${result.width}x${result.height}px`);

            await this.extractPathsFromCurrentPage();
            this.setupCanvasOverlay(result.page);
            // Image extraction runs after the overlay is set up so it can
            // immediately pass image metadata to the overlay for display.
            await this.extractImagesFromCurrentPage();
            this.updateThumbnailHighlight();
        } else {
            console.error(`Error rendering page: ${result.error}`);
        }
    }

    async extractImagesFromCurrentPage() {
        const page = this.pdfLoader.getCurrentPageObject();
        if (!page) return;

        try {
            const images = await this.imageExtractor.extractImages(page, this.currentPageNum);

            // Pass images to overlay so it can draw bounding rectangles.
            if (this.canvasOverlay) {
                this.canvasOverlay.setImages(images);
            }

            // Update the Images panel.
            this.updateImageList(images);

            console.log(`✓ Found ${images.length} raster image(s) on page`);
        } catch (e) {
            console.warn('Image extraction failed:', e);
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
        this.canvasOverlay.setRotation(this.pdfLoader.getRotation());

        if (this.multiSelectMode) {
            this.canvasOverlay.setMultiSelectMode(true);
        }

        this.canvasOverlay.overlayCanvas.addEventListener('curveSelected', (e) => {
            this.handleCurveSelection(e.detail);
        });

        this.canvasOverlay.overlayCanvas.addEventListener('imageSelected', (e) => {
            this.handleImageSelection(e.detail.image);
        });

        if (this.selectionMode) {
            this.canvasOverlay.enableSelectionMode(true);
        } else if (this.imageExportMode) {
            this.canvasOverlay.enableImageMode(true);
        }
    }

    toggleSelectionMode() {
        // Deactivate Image Export mode if it was on (mutually exclusive).
        if (this.imageExportMode) {
            this.imageExportMode = false;
            if (this.toggleImageExportBtn) {
                this.toggleImageExportBtn.textContent = 'Image Export';
                this.toggleImageExportBtn.classList.remove('active');
            }
            this.imagesSection.style.display = 'none';
            if (this.canvasOverlay) this.canvasOverlay.enableImageMode(false);
        }

        this.selectionMode = !this.selectionMode;

        if (this.canvasOverlay) {
            this.canvasOverlay.enableSelectionMode(this.selectionMode);
        }

        if (this.selectionMode) {
            this.toggleSelectionBtn.textContent = 'Disable Curve Selection';
            this.toggleSelectionBtn.classList.add('active');
            this.labelingSection.style.display = 'block';
            this.calibrationSection.style.display = 'block';
            console.log('Curve selection mode enabled');
        } else {
            this.toggleSelectionBtn.textContent = 'Curve Selection';
            this.toggleSelectionBtn.classList.remove('active');
            this.labelingSection.style.display = 'none';
            this.calibrationSection.style.display = 'none';
            console.log('Curve selection mode disabled');
        }
    }

    toggleImageExportMode() {
        // Deactivate Curve Selection mode if it was on (mutually exclusive).
        if (this.selectionMode) {
            this.selectionMode = false;
            this.toggleSelectionBtn.textContent = 'Curve Selection';
            this.toggleSelectionBtn.classList.remove('active');
            this.labelingSection.style.display = 'none';
            this.calibrationSection.style.display = 'none';
            if (this.canvasOverlay) this.canvasOverlay.enableSelectionMode(false);
        }

        this.imageExportMode = !this.imageExportMode;

        if (this.canvasOverlay) {
            this.canvasOverlay.enableImageMode(this.imageExportMode);
        }

        if (this.imageExportMode) {
            this.toggleImageExportBtn.textContent = 'Disable Image Export';
            this.toggleImageExportBtn.classList.add('active');
            // Show the images section (even if empty, to give feedback).
            this.imagesSection.style.display = 'block';
        } else {
            this.toggleImageExportBtn.textContent = 'Image Export';
            this.toggleImageExportBtn.classList.remove('active');
            this.imagesSection.style.display = 'none';
        }
    }

    handleCurveSelection(detail) {
        if (this.calibrationMode && this.pendingCalibration) {
            if (this.equalScaleMode) {
                this.handleEqualScaleCalibrationCurve(detail.curve);
            } else {
                this.handleIndependentCalibrationCurve(detail);
            }
        } else {
            if (this.multiSelectMode) {
                if (!this.curveLabelInput.value.trim()) {
                    this.curveLabelInput.focus();
                }
            } else {
                this.selectedCurveForLabeling = detail.curve;
                console.log(`Selected curve with ${detail.curve.points.length} points - enter a label to save it`);
                this.curveLabelInput.focus();
            }
        }
    }

    handleImageSelection(image) {
        this.selectedImage = image;

        // Highlight the corresponding row in the Images panel.
        if (this.imageList) {
            this.imageList.querySelectorAll('.image-list-item').forEach(li => {
                li.classList.toggle('active', parseInt(li.dataset.index) === image.imageIndex);
            });
        }

        if (this.saveImageBtn) {
            this.saveImageBtn.disabled = false;
        }

        console.log(`Selected raster image #${image.imageIndex + 1} ` +
            `(${image.width}×${image.height} px)`);
    }

    updateImageList(images) {
        if (!this.imagesSection || !this.imageList) return;

        this.selectedImage = null;
        if (this.saveImageBtn) this.saveImageBtn.disabled = true;

        // Section visibility is controlled by toggleImageExportMode(), not here.
        // Just update the list contents.
        if (images.length === 0) {
            this.imageList.innerHTML = '<li class="empty-message">No raster images detected on this page</li>';
            return;
        }

        this.imageList.innerHTML = '';

        images.forEach((img, index) => {
            const { width, height } = img;
            const li = document.createElement('li');
            li.className = 'image-list-item';
            li.dataset.index = index;
            li.innerHTML = `
                <span class="image-label">Image ${index + 1}</span>
                <span class="image-details">${width}&thinsp;&times;&thinsp;${height} px</span>
            `;
            li.addEventListener('click', () => {
                // Clicking the list row selects the image and highlights it on the overlay.
                const imageWithIndex = { ...img, imageIndex: index };
                if (this.canvasOverlay) {
                    this.canvasOverlay.selectedImage = imageWithIndex;
                    this.canvasOverlay.redraw();
                }
                this.handleImageSelection(imageWithIndex);
            });
            this.imageList.appendChild(li);
        });
    }

    async saveSelectedImageAsPNG() {
        if (!this.selectedImage) {
            console.warn('No raster image selected');
            return;
        }

        try {
            const blob = await this.imageExtractor.exportImageAsPNG(this.selectedImage);
            const url  = URL.createObjectURL(blob);
            const a    = document.createElement('a');
            a.href     = url;
            a.download = `image_${this.selectedImage.imageIndex + 1}.png`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            console.log(`Saved image ${this.selectedImage.imageIndex + 1} as PNG ` +
                `(${this.selectedImage.width}×${this.selectedImage.height} px)`);
        } catch (e) {
            console.error('PNG export failed:', e);
            alert(`Could not save image: ${e.message}`);
        }
    }

    handleIndependentCalibrationCurve(detail) {
        const curve = detail.curve;
        const { axis } = this.pendingCalibration;

        if (curve.points.length >= 2) {
            this.axisCalibrator.setCalibrationSegment(axis, curve);
            this.updateCalibrationStatus(axis, true);
            console.log(`${axis.toUpperCase()}-axis calibration path selected with ${curve.points.length} points`);
        }

        // Auto-advance from X to Y axis
        if (axis === 'x' && !this.axisCalibrator.hasSegment('y')) {
            this.pendingCalibration = { axis: 'y' };
            this.axisCalibrator.startCalibration('y');
            this.showCalibrationPrompt('Now click a line for the Y-axis');
            this.checkCalibrationComplete();
            return;
        }

        this.calibrationMode = false;
        this.pendingCalibration = null;
        this.canvas.style.cursor = 'default';

        if (axis === 'y' && !this.axisCalibrator.isCalibrated) {
            this.showCalibrationPrompt('Now enter min/max values for each axis');
        } else {
            this.hideCalibrationPrompt();
        }

        this.checkCalibrationComplete();
        this._restoreSelectionMode();
    }

    handleEqualScaleCalibrationCurve(curve) {
        const step = this.pendingCalibration.step;

        if (step === 'scale') {
            this.axisCalibrator.setCalibrationSegment(this.equalScaleAxis, curve);
            this.equalScaleAxisStatus.textContent = '✓';
            this.equalScaleAxisStatus.style.color = '#4CAF50';
            console.log(`1:1 scale reference (${this.equalScaleAxis.toUpperCase()}) selected with ${curve.points.length} points`);
        } else if (step === 'perp') {
            this.perpRefCurve = curve;
            this.perpRefStatus.textContent = '✓';
            this.perpRefStatus.style.color = '#4CAF50';
            console.log(`Perpendicular origin reference selected with ${curve.points.length} points`);
        }

        this.calibrationMode = false;
        this.pendingCalibration = null;
        this.hideCalibrationPrompt();
        this.updateEqualScaleCalibration();
        this._restoreSelectionMode();
    }

    _restoreSelectionMode() {
        if (this.selectionMode) {
            this.canvasOverlay.enableSelectionMode(true);
        } else {
            this.canvasOverlay.enableSelectionMode(false);
        }
    }

    saveLabeledCurve() {
        const label = this.curveLabelInput.value.trim();
        if (!label) {
            console.log('Please enter a label for the curve.');
            this.curveLabelInput.focus();
            return;
        }

        if (this.multiSelectMode) {
            const selectedIndices = this.canvasOverlay.getMultiSelectedIndices();
            if (selectedIndices.size === 0) {
                console.log('No curves selected. Please click on curves first.');
                return;
            }
            const allCurves = this.pathExtractor.getCurves();
            const curves = [...selectedIndices].map(i => ({ ...allCurves[i], curveIndex: i }));
            this.labeledCurves.push({ label, curves });
            console.log(`Saved ${curves.length} curve(s) with label "${label}"`);
            this.canvasOverlay.clearMultiSelection();
        } else {
            if (!this.selectedCurveForLabeling) {
                console.log('No curve selected. Please click on a curve first.');
                return;
            }
            const existingIndex = this.labeledCurves.findIndex(
                lc => lc.curves.length === 1 && lc.curves[0].curveIndex === this.selectedCurveForLabeling.curveIndex
            );
            if (existingIndex >= 0) {
                this.labeledCurves[existingIndex].label = label;
                console.log(`Updated label for curve to "${label}"`);
            } else {
                this.labeledCurves.push({ label, curves: [this.selectedCurveForLabeling] });
                console.log(`Saved curve with label "${label}"`);
            }
            this.canvasOverlay.clearSelection();
            this.selectedCurveForLabeling = null;
        }

        this.curveLabelInput.value = '';
        this.updateCurveBrowser();
        this.updateExportPreview();

        if (this.labeledCurves.length > 0 && this.axisCalibrator.isCalibrated) {
            this.exportSection.style.display = 'block';
        }
    }

    toggleMultiSelectMode() {
        this.multiSelectMode = this.multiSelectCheckbox.checked;
        if (this.canvasOverlay) {
            this.canvasOverlay.setMultiSelectMode(this.multiSelectMode);
        }
        if (!this.multiSelectMode) {
            this.selectedCurveForLabeling = null;
        }
        if (this.labelingInstruction) {
            this.labelingInstruction.textContent = this.multiSelectMode
                ? 'Enter a label, then click curves to add them to that dataset.'
                : 'Click on a curve to select it, then enter a label to add it.';
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

            const totalPoints = labeledCurve.curves.reduce((sum, c) => sum + c.points.length, 0);
            const detailStr = labeledCurve.curves.length > 1
                ? `${labeledCurve.curves.length} curves, ${totalPoints} pts`
                : `${totalPoints} pts`;

            li.innerHTML = `
                <div class="curve-info">
                    <span class="curve-label">${this.escapeHtml(labeledCurve.label)}</span>
                    <span class="curve-details" style="float: right">${detailStr}</span>
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
            this.canvasOverlay.setHighlightedCurveIndices(labeledCurve.curves.map(c => c.curveIndex));
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
                this.canvasOverlay.clearMultiSelection();
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

    startSequentialCalibration() {
        // Start with X-axis
        this.calibrationMode = true;
        this.pendingCalibration = { axis: 'x' };

        this.axisCalibrator.startCalibration('x');
        this.showCalibrationPrompt('Click a line representing the X-axis');

        if (this.canvasOverlay) {
            this.canvasOverlay.enableSingleSelectionMode(true);
        }

        this.canvas.style.cursor = 'crosshair';
    }

    // ── 1:1 scale calibration ──────────────────────────────────────────────

    toggleCalibrationMode(isEqualScale) {
        this.equalScaleMode = isEqualScale;
        this.independentCalPanel.style.display = isEqualScale ? 'none' : 'block';
        this.equalScalePanel.style.display     = isEqualScale ? 'block' : 'none';
        this.resetCalibration();
    }

    updateEqualScaleAxisChoice(axis) {
        this.equalScaleAxis = axis;
        const perpAxis = axis === 'x' ? 'y' : 'x';

        // Update labels
        this.equalScaleAxisLabelEl.textContent  = axis.toUpperCase();
        this.perpOriginHeaderEl.textContent     = perpAxis.toUpperCase() + ' origin';
        this.perpAutoAxisLabelEl.textContent    = perpAxis.toUpperCase();
        this.perpSelectAxisLabelEl.textContent  = perpAxis.toUpperCase();
        this.equalScaleMinInput.placeholder     = axis.toUpperCase() + ' Min';
        this.equalScaleMaxInput.placeholder     = axis.toUpperCase() + ' Max';

        // Reset so stale calibration doesn't carry over
        this.axisCalibrator.reset();
        this.perpRefCurve = null;
        this.equalScaleAxisStatus.textContent = '○';
        this.equalScaleAxisStatus.style.color = '#999';
        this.perpRefStatus.textContent = '○';
        this.perpRefStatus.style.color = '#999';
        this.equalScaleMinInput.value = '';
        this.equalScaleMaxInput.value = '';
        this.checkCalibrationComplete();
    }

    startEqualScaleCalibration() {
        this.calibrationMode = true;
        this.pendingCalibration = { step: 'scale' };
        this.showCalibrationPrompt(`Click a line representing the ${this.equalScaleAxis.toUpperCase()}-axis`);
        if (this.canvasOverlay) {
            this.canvasOverlay.enableSingleSelectionMode(true);
        }
    }

    updatePerpOriginMode(mode) {
        this.perpOriginMode = mode;
        if (this.perpSelectControls) {
            this.perpSelectControls.style.display = mode === 'select' ? 'flex' : 'none';
        }
        this.updateEqualScaleCalibration();
    }

    startPerpRefSelection() {
        this.calibrationMode = true;
        this.pendingCalibration = { step: 'perp' };
        const perpAxis = this.equalScaleAxis === 'x' ? 'y' : 'x';
        this.showCalibrationPrompt(`Click a ${perpAxis.toUpperCase()}-axis reference line for the origin`);
        if (this.canvasOverlay) {
            this.canvasOverlay.enableSingleSelectionMode(true);
        }
    }

    updateEqualScaleCalibration() {
        if (!this.equalScaleMode) return;

        const scaleAxis = this.equalScaleAxis;
        const perpAxis  = scaleAxis === 'x' ? 'y' : 'x';

        // Push scale-axis data values into the calibrator
        const minVal = parseFloat(this.equalScaleMinInput.value);
        const maxVal = parseFloat(this.equalScaleMaxInput.value);
        if (!isNaN(minVal)) this.axisCalibrator.setCalibrationValue(scaleAxis, 'start', minVal);
        if (!isNaN(maxVal)) this.axisCalibrator.setCalibrationValue(scaleAxis, 'end',   maxVal);

        // Can't synthesise perpendicular axis until scale axis is fully calibrated
        if (!this.axisCalibrator.isAxisCalibrated(scaleAxis)) {
            this.checkCalibrationComplete();
            return;
        }

        const scaleSegment = this.axisCalibrator.calibrationSegments[scaleAxis + 'Axis'];

        if (this.perpOriginMode === 'auto') {
            const perpDataVal = parseFloat(this.perpDataValueInput.value);
            if (isNaN(perpDataVal)) { this.checkCalibrationComplete(); return; }

            // Pixel reference is the scale curve's extent in the perpendicular direction
            const perpPixelRef = (perpAxis === 'y') ? scaleSegment.y1 : scaleSegment.x1;
            this.axisCalibrator.synthesizeEqualScaleAxis(perpAxis, perpPixelRef, perpDataVal);

        } else {
            if (!this.perpRefCurve) { this.checkCalibrationComplete(); return; }

            const perpDataVal = parseFloat(this.perpRefDataValueInput.value);
            if (isNaN(perpDataVal)) { this.checkCalibrationComplete(); return; }

            // Pixel reference is the min-coordinate of the separately selected reference curve
            const refSeg = this.axisCalibrator.extractMinMaxFromPoints(this.perpRefCurve.points);
            const perpPixelRef = (perpAxis === 'y') ? refSeg.y1 : refSeg.x1;
            this.axisCalibrator.synthesizeEqualScaleAxis(perpAxis, perpPixelRef, perpDataVal);
        }

        this.checkCalibrationComplete();
    }

    // ── End 1:1 scale calibration ──────────────────────────────────────────

    showCalibrationPrompt(message) {
        if (this.calibrationPrompt) {
            this.calibrationPrompt.textContent = message;
            this.calibrationPrompt.style.display = 'inline';
        }
    }

    hideCalibrationPrompt() {
        if (this.calibrationPrompt) {
            this.calibrationPrompt.textContent = '';
            this.calibrationPrompt.style.display = 'none';
        }
    }

    startAxisSelection(axis) {
        this.calibrationMode = true;
        this.pendingCalibration = { axis };

        const info = this.axisCalibrator.startCalibration(axis);
        console.log(info.message);

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
            this.hideCalibrationPrompt();

            this.exportSection.style.display = 'block';
            this.updateExportPreview();
        } else if (this.equalScaleMode) {
            const scaleAxis = this.equalScaleAxis;
            const scaleCalibrated = this.axisCalibrator.isAxisCalibrated(scaleAxis);
            const scaleStatus = scaleCalibrated ? '✅' : '⏳';
            this.calibrationStatus.innerHTML = `<span class="status-text">Scale ref: ${scaleStatus} | Origin: ⏳</span>`;
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

        // Reset calibration mode state
        this.calibrationMode = false;
        this.pendingCalibration = null;
        this.canvas.style.cursor = 'default';
        this.hideCalibrationPrompt();

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

        // Reset equal-scale state
        this.perpRefCurve = null;
        this.perpOriginMode = 'auto';
        if (this.perpOriginAutoRadio) this.perpOriginAutoRadio.checked = true;
        if (this.perpSelectControls)  this.perpSelectControls.style.display = 'none';
        if (this.equalScaleAxisStatus) {
            this.equalScaleAxisStatus.textContent = '○';
            this.equalScaleAxisStatus.style.color = '#999';
        }
        if (this.perpRefStatus) {
            this.perpRefStatus.textContent = '○';
            this.perpRefStatus.style.color = '#999';
        }
        if (this.equalScaleMinInput)    this.equalScaleMinInput.value = '';
        if (this.equalScaleMaxInput)    this.equalScaleMaxInput.value = '';
        if (this.perpDataValueInput)    this.perpDataValueInput.value = '0';
        if (this.perpRefDataValueInput) this.perpRefDataValueInput.value = '';

        this.calibrationStatus.innerHTML = '<span class="status-text">Not calibrated</span>';
        this.exportSection.style.display = 'none';

        console.log('Calibration reset');
    }

    async goToPage(pageNum) {
        if (pageNum < 1 || pageNum > this.totalPages || pageNum === this.currentPageNum) return;
        this.currentPageNum = pageNum;
        if (this.selectionMode) this.toggleSelectionMode();
        await this.renderCurrentPage();
    }

    async changePage(delta) {
        await this.goToPage(this.currentPageNum + delta);
    }

    async jumpToPage() {
        const val = parseInt(this.pageNum.value, 10);
        if (isNaN(val) || val < 1 || val > this.totalPages) {
            this.pageNum.value = this.currentPageNum;
            return;
        }
        await this.goToPage(val);
    }

    toggleThumbnailSidebar() {
        const visible = this.thumbnailSidebar.style.display !== 'none';
        this.thumbnailSidebar.style.display = visible ? 'none' : 'flex';
        this.thumbnailResizeHandle.style.display = visible ? 'none' : 'block';
    }

    generateThumbnails() {
        if (this.thumbnailObserver) {
            this.thumbnailObserver.disconnect();
            this.thumbnailObserver = null;
        }
        this.thumbnailSidebar.innerHTML = '';

        const THUMB_WIDTH = Math.max(60, this.thumbnailSidebar.clientWidth - 30);

        this.thumbnailObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting && !entry.target.dataset.rendered) {
                    entry.target.dataset.rendered = 'true';
                    const pageNum = parseInt(entry.target.dataset.page);
                    const canvas = entry.target.querySelector('canvas');
                    this.renderThumbnail(pageNum, canvas, THUMB_WIDTH);
                }
            });
        }, { root: this.thumbnailSidebar, rootMargin: '100px', threshold: 0.01 });

        for (let i = 1; i <= this.totalPages; i++) {
            const item = document.createElement('div');
            item.className = 'thumbnail-item';
            item.dataset.page = i;
            if (i === this.currentPageNum) item.classList.add('active');

            const canvas = document.createElement('canvas');
            canvas.className = 'thumbnail-canvas';

            const label = document.createElement('div');
            label.className = 'thumbnail-page-num';
            label.textContent = i;

            item.appendChild(canvas);
            item.appendChild(label);
            item.addEventListener('click', () => this.goToPage(i));

            this.thumbnailSidebar.appendChild(item);
            this.thumbnailObserver.observe(item);
        }
    }

    async renderThumbnail(pageNum, canvas, displayWidth) {
        try {
            const page = await this.pdfLoader.pdfDocument.getPage(pageNum);
            const unscaled = page.getViewport({ scale: 1 });
            const scale = displayWidth / unscaled.width;
            const viewport = page.getViewport({ scale });

            canvas.width = viewport.width;
            canvas.height = viewport.height;
            canvas.style.width = displayWidth + 'px';
            canvas.style.height = Math.round(viewport.height) + 'px';

            await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        } catch (e) {
            console.error(`Thumbnail render error (page ${pageNum}):`, e);
        }
    }

    updateThumbnailHighlight() {
        if (!this.thumbnailSidebar) return;
        this.thumbnailSidebar.querySelectorAll('.thumbnail-item').forEach(item => {
            item.classList.toggle('active', parseInt(item.dataset.page) === this.currentPageNum);
        });
        const active = this.thumbnailSidebar.querySelector('.thumbnail-item.active');
        if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
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
