/**
 * UnPlotter - PDF Data Extractor
 * Copyright (c) 2025 Robert McDonald
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information.
 */

export class PDFLoader {
    constructor() {
        this.pdfDocument = null;
        this.currentPageObject = null;
        this.scale = 1.5;
        this.rotation = 0; // Add rotation state (0, 90, 180, 270)
        this.pdfjsLib = null;
        this.ready = this.initPDFJS();
    }

    async initPDFJS() {
        try {
            // Import PDF.js from CDN using ES modules
            this.pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/+esm');
            
            // Configure the worker
            this.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
            
            console.log('PDF.js loaded successfully');
        } catch (error) {
            console.error('Error loading PDF.js:', error);
            throw error;
        }
    }

    async loadPDF(file) {
        await this.ready;
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = this.pdfjsLib.getDocument({ data: arrayBuffer });
            this.pdfDocument = await loadingTask.promise;
            
            console.log('PDF loaded successfully');
            console.log(`Number of pages: ${this.pdfDocument.numPages}`);
            
            return {
                success: true,
                numPages: this.pdfDocument.numPages,
                document: this.pdfDocument
            };
        } catch (error) {
            console.error('Error loading PDF:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async renderPage(pageNumber, canvas) {
        await this.ready;
        
        if (!this.pdfDocument) {
            throw new Error('No PDF document loaded');
        }

        try {
            const page = await this.pdfDocument.getPage(pageNumber);
            this.currentPageObject = page;

            // Get viewport with rotation
            const viewport = page.getViewport({ 
                scale: this.scale,
                rotation: this.rotation 
            });

            // Set canvas dimensions
            const context = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            // Render the page
            const renderContext = {
                canvasContext: context,
                viewport: viewport
            };

            await page.render(renderContext).promise;

            console.log(`Page ${pageNumber} rendered with rotation ${this.rotation}°`);
            console.log(`Viewport: width=${viewport.width}, height=${viewport.height}, scale=${viewport.scale}`);
            
            return {
                success: true,
                width: viewport.width,
                height: viewport.height,
                page: page,
                viewport: viewport
            };
        } catch (error) {
            console.error('Error rendering page:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    getCurrentPageObject() {
        return this.currentPageObject;
    }

    setScale(scale) {
        this.scale = scale;
    }

    getScale() {
        return this.scale;
    }

    setRotation(rotation) {
        // Normalize rotation to 0, 90, 180, 270
        this.rotation = ((rotation % 360) + 360) % 360;
    }

    getRotation() {
        return this.rotation;
    }

    rotateClockwise() {
        this.rotation = (this.rotation + 90) % 360;
        return this.rotation;
    }

    rotateCounterClockwise() {
        this.rotation = (this.rotation - 90 + 360) % 360;
        return this.rotation;
    }
    
    // Expose PDF.js OPS constants
    get OPS() {
        return this.pdfjsLib?.OPS;
    }
}
