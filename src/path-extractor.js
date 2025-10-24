/**
 * UnPlotter - PDF Data Extractor
 * Copyright (c) 2025 Robert McDonald
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information.
 */

export class PathExtractor {
    constructor(pdfLoader) {
        this.pdfLoader = pdfLoader;
        this.paths = [];
        this.currentPath = null;
        this.transformStack = [];
        this.currentTransform = [1, 0, 0, 1, 0, 0]; // Identity matrix

        // this.iop = 0;
    }

    /**
     * Extract paths from a PDF page by intercepting operator list
     */
    async extractPaths(page) {
        this.paths = [];
        this.currentPath = null;
        this.transformStack = [];
        this.currentTransform = [1, 0, 0, 1, 0, 0]; // Reset to identity

        try {
            // Get the operator list - this contains all drawing commands
            const operatorList = await page.getOperatorList();

            console.log('Operator list retrieved:', operatorList.fnArray.length, 'operations');

            // Process each operation
            for (let i = 0; i < operatorList.fnArray.length; i++) {
                const fn = operatorList.fnArray[i];
                const args = operatorList.argsArray[i];

                this.processOperation(fn, args);
            }

            // Finalize any open path
            if (this.currentPath && this.currentPath.commands.length > 0) {
                this.paths.push(this.currentPath);
            }

            console.log(`Extracted ${this.paths.length} paths with ${this.getTotalPoints()} total points`);

            return this.paths;
        } catch (error) {
            console.error('Error extracting paths:', error);
            return [];
        }
    }

    /**
     * Apply transformation matrix to a point
     */
    applyTransform(x, y, transform) {
        const [a, b, c, d, e, f] = transform;
        return {
            x: a * x + c * y + e,
            y: b * x + d * y + f
        };
    }

    /**
     * Multiply two transformation matrices
     */
    multiplyTransforms(t1, t2) {
        const [a1, b1, c1, d1, e1, f1] = t1;
        const [a2, b2, c2, d2, e2, f2] = t2;

        return [
            a1 * a2 + c1 * b2,
            b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2,
            b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1,
            b1 * e2 + d1 * f2 + f1
        ];
    }

    opName(o) {

        const OPS = this.pdfLoader.OPS;

        let ret = "unknown";

        switch (o) {
            case OPS.dependency:
                ret = "dependency";
                break;
            case OPS.setLineWidth:
                ret = "setLineWidth";
                break;
            case OPS.setLineCap:
                ret = "setLineCap";
                break;
            case OPS.setLineJoin:
                ret = "setLineJoin";
                break;
            case OPS.setMiterLimit:
                ret = "setMiterLimit";
                break;
            case OPS.setDash:
                ret = "setDash";
                break;
            case OPS.setRenderingIntent:
                ret = "setRenderingIntent";
                break;
            case OPS.setFlatness:
                ret = "setFlatness";
                break;
            case OPS.setGState:
                ret = "setGState";
                break;
            case OPS.save:
                ret = "save";
                break;
            case OPS.restore:
                ret = "restore";
                break;
            case OPS.transform:
                ret = "transform";
                break;
            case OPS.moveTo:
                ret = "moveTo";
                break;
            case OPS.lineTo:
                ret = "lineTo";
                break;
            case OPS.curveTo:
                ret = "curveTo";
                break;
            case OPS.curveTo2:
                ret = "curveTo2";
                break;
            case OPS.curveTo3:
                ret = "curveTo3";
                break;
            case OPS.closePath:
                ret = "closePath";
                break;
            case OPS.rectangle:
                ret = "rectangle";
                break;
            case OPS.stroke:
                ret = "stroke";
                break;
            case OPS.closeStroke:
                ret = "closeStroke";
                break;
            case OPS.fill:
                ret = "fill";
                break;
            case OPS.eoFill:
                ret = "eoFill";
                break;
            case OPS.fillStroke:
                ret = "fillStroke";
                break;
            case OPS.eoFillStroke:
                ret = "eoFillStroke";
                break;
            case OPS.closeFillStroke:
                ret = "closeFillStroke";
                break;
            case OPS.closeEOFillStroke:
                ret = "closeEOFillStroke";
                break;
            case OPS.endPath:
                ret = "endPath";
                break;
            case OPS.clip:
                ret = "clip";
                break;
            case OPS.eoClip:
                ret = "eoClip";
                break;
            case OPS.beginText:
                ret = "beginText";
                break;
            case OPS.endText:
                ret = "endText";
                break;
            case OPS.setCharSpacing:
                ret = "setCharSpacing";
                break;
            case OPS.setWordSpacing:
                ret = "setWordSpacing";
                break;
            case OPS.setHScale:
                ret = "setHScale";
                break;
            case OPS.setLeading:
                ret = "setLeading";
                break;
            case OPS.setFont:
                ret = "setFont";
                break;
            case OPS.setTextRenderingMode:
                ret = "setTextRenderingMode";
                break;
            case OPS.setTextRise:
                ret = "setTextRise";
                break;
            case OPS.moveText:
                ret = "moveText";
                break;
            case OPS.setLeadingMoveText:
                ret = "setLeadingMoveText";
                break;
            case OPS.setTextMatrix:
                ret = "setTextMatrix";
                break;
            case OPS.nextLine:
                ret = "nextLine";
                break;
            case OPS.showText:
                ret = "showText";
                break;
            case OPS.showSpacedText:
                ret = "showSpacedText";
                break;
            case OPS.nextLineShowText:
                ret = "nextLineShowText";
                break;
            case OPS.nextLineSetSpacingShowText:
                ret = "nextLineSetSpacingShowText";
                break;
            case OPS.setCharWidth:
                ret = "setCharWidth";
                break;
            case OPS.setCharWidthAndBounds:
                ret = "setCharWidthAndBounds";
                break;
            case OPS.setStrokeColorSpace:
                ret = "setStrokeColorSpace";
                break;
            case OPS.setFillColorSpace:
                ret = "setFillColorSpace";
                break;
            case OPS.setStrokeColor:
                ret = "setStrokeColor";
                break;
            case OPS.setStrokeColorN:
                ret = "setStrokeColorN";
                break;
            case OPS.setFillColor:
                ret = "setFillColor";
                break;
            case OPS.setFillColorN:
                ret = "setFillColorN";
                break;
            case OPS.setStrokeGray:
                ret = "setStrokeGray";
                break;
            case OPS.setFillGray:
                ret = "setFillGray";
                break;
            case OPS.setStrokeRGBColor:
                ret = "setStrokeRGBColor";
                break;
            case OPS.setFillRGBColor:
                ret = "setFillRGBColor";
                break;
            case OPS.setStrokeCMYKColor:
                ret = "setStrokeCMYKColor";
                break;
            case OPS.setFillCMYKColor:
                ret = "setFillCMYKColor";
                break;
            case OPS.shadingFill:
                ret = "shadingFill";
                break;
            case OPS.beginInlineImage:
                ret = "beginInlineImage";
                break;
            case OPS.beginImageData:
                ret = "beginImageData";
                break;
            case OPS.endInlineImage:
                ret = "endInlineImage";
                break;
            case OPS.paintXObject:
                ret = "paintXObject";
                break;
            case OPS.markPoint:
                ret = "markPoint";
                break;
            case OPS.markPointProps:
                ret = "markPointProps";
                break;
            case OPS.beginMarkedContent:
                ret = "beginMarkedContent";
                break;
            case OPS.beginMarkedContentProps:
                ret = "beginMarkedContentProps";
                break;
            case OPS.endMarkedContent:
                ret = "endMarkedContent";
                break;
            case OPS.beginCompat:
                ret = "beginCompat";
                break;
            case OPS.endCompat:
                ret = "endCompat";
                break;
            case OPS.paintFormXObjectBegin:
                ret = "paintFormXObjectBegin";
                break;
            case OPS.paintFormXObjectEnd:
                ret = "paintFormXObjectEnd";
                break;
            case OPS.beginGroup:
                ret = "beginGroup";
                break;
            case OPS.endGroup:
                ret = "endGroup";
                break;
            case OPS.beginAnnotation:
                ret = "beginAnnotation";
                break;
            case OPS.endAnnotation:
                ret = "endAnnotation";
                break;
            case OPS.paintImageMaskXObject:
                ret = "paintImageMaskXObject";
                break;
            case OPS.paintImageMaskXObjectGroup:
                ret = "paintImageMaskXObjectGroup";
                break;
            case OPS.paintImageXObject:
                ret = "paintImageXObject";
                break;
            case OPS.paintInlineImageXObject:
                ret = "paintInlineImageXObject";
                break;
            case OPS.paintInlineImageXObjectGroup:
                ret = "paintInlineImageXObjectGroup";
                break;
            case OPS.paintImageXObjectRepeat:
                ret = "paintImageXObjectRepeat";
                break;
            case OPS.paintImageMaskXObjectRepeat:
                ret = "paintImageMaskXObjectRepeat";
                break;
            case OPS.paintSolidColorImageMask:
                ret = "paintSolidColorImageMask";
                break;
            case OPS.constructPath:
                ret = "constructPath";
                break;
            case OPS.setStrokeTransparent:
                ret = "setStrokeTransparent";
                break;
            case OPS.setFillTransparent:
                ret = "setFillTransparent";
                break;
        }

        return ret;
    }

    /**
     * Process individual PDF operations
     */
    processOperation(fn, args) {
        // Get OPS constants from PDFLoader
        const OPS = this.pdfLoader.OPS;

        // console.log('op:', this.iop, fn, this.opName(fn), args);
        // this.iop++;

        switch (fn) {
            // Graphics state operations
            case OPS.save:
                this.transformStack.push([...this.currentTransform]);
                break;

            case OPS.restore:
                if (this.transformStack.length > 0) {
                    this.currentTransform = this.transformStack.pop();
                }
                break;

            case OPS.transform:
                this.currentTransform = this.multiplyTransforms(this.currentTransform, args);
                console.log('Transform applied:', args, '-> Current:', this.currentTransform);
                break;

            // Path construction operations - APPLY CTM
            case OPS.moveTo:
                const p0 = this.applyTransform(args[0], args[1], this.currentTransform);
                this.addCommand('M', p0.x, p0.y);
                break;

            case OPS.lineTo:
                const p1 = this.applyTransform(args[0], args[1], this.currentTransform);
                this.addCommand('L', p1.x, p1.y);
                break;

            case OPS.curveTo:
                const c1 = this.applyTransform(args[0], args[1], this.currentTransform);
                const c2 = this.applyTransform(args[2], args[3], this.currentTransform);
                const p2 = this.applyTransform(args[4], args[5], this.currentTransform);
                this.addCommand('C', c1.x, c1.y, c2.x, c2.y, p2.x, p2.y);
                break;

            case OPS.curveTo2:
                const c2_1 = this.applyTransform(args[0], args[1], this.currentTransform);
                const p3 = this.applyTransform(args[2], args[3], this.currentTransform);
                this.addCommand('V', c2_1.x, c2_1.y, p3.x, p3.y);
                break;

            case OPS.curveTo3:
                const c3_1 = this.applyTransform(args[0], args[1], this.currentTransform);
                const p4 = this.applyTransform(args[2], args[3], this.currentTransform);
                this.addCommand('Y', c3_1.x, c3_1.y, p4.x, p4.y);
                break;

            case OPS.closePath:
                this.addCommand('Z');
                break;

            case OPS.rectangle:
                const rx = args[0];
                const ry = args[1];
                const rw = args[2];
                const rh = args[3];

                const rp1 = this.applyTransform(rx, ry, this.currentTransform);
                const rp2 = this.applyTransform(rx + rw, ry, this.currentTransform);
                const rp3 = this.applyTransform(rx + rw, ry + rh, this.currentTransform);
                const rp4 = this.applyTransform(rx, ry + rh, this.currentTransform);

                this.addCommand('M', rp1.x, rp1.y);
                this.addCommand('L', rp2.x, rp2.y);
                this.addCommand('L', rp3.x, rp3.y);
                this.addCommand('L', rp4.x, rp4.y);
                this.addCommand('Z');
                break;

            case OPS.stroke:
            case OPS.fillStroke:
            case OPS.fill:
            case OPS.eoFill:
            case OPS.eoFillStroke:
                if (this.currentPath && this.currentPath.commands.length > 0) {
                    this.currentPath.operation = this.getOperationName(fn);
                    this.paths.push(this.currentPath);
                    this.currentPath = null;
                }
                break;

            case OPS.constructPath:
                this.processConstructPath(args);
                break;

            default:
                // console.log('Unknown operation:', fn, this.opName(fn), args);
                break;
        }
    }

    addCommand(type, ...coords) {
        if (!this.currentPath) {
            this.currentPath = {
                commands: [],
                operation: 'unknown',
                bounds: null
            };
        }

        this.currentPath.commands.push({
            type: type,
            coords: coords
        });
    }

    processConstructPath(args) {
        const ops = args[0];
        const points = args[1];
        let pointIndex = 0;

        // Get OPS constants from PDFLoader
        const OPS = this.pdfLoader.OPS;

        for (let op of ops) {
            switch (op) {
                case OPS.moveTo:
                    const mp = this.applyTransform(points[pointIndex++], points[pointIndex++], this.currentTransform);
                    this.addCommand('M', mp.x, mp.y);
                    break;
                case OPS.lineTo:
                    const lp = this.applyTransform(points[pointIndex++], points[pointIndex++], this.currentTransform);
                    this.addCommand('L', lp.x, lp.y);
                    break;
                case OPS.curveTo:
                    const cp1 = this.applyTransform(points[pointIndex++], points[pointIndex++], this.currentTransform);
                    const cp2 = this.applyTransform(points[pointIndex++], points[pointIndex++], this.currentTransform);
                    const cp3 = this.applyTransform(points[pointIndex++], points[pointIndex++], this.currentTransform);
                    this.addCommand('C', cp1.x, cp1.y, cp2.x, cp2.y, cp3.x, cp3.y);
                    break;
                case OPS.closePath:
                    this.addCommand('Z');
                    break;
            }
        }
    }

    getOperationName(fn) {
        const OPS = window.pdfjsLib.OPS;
        const opNames = {
            [OPS.stroke]: 'stroke',
            [OPS.fill]: 'fill',
            [OPS.fillStroke]: 'fillStroke',
            [OPS.eoFill]: 'eoFill',
            [OPS.eoFillStroke]: 'eoFillStroke'
        };
        return opNames[fn] || 'unknown';
    }

    getTotalPoints() {
        return this.paths.reduce((total, path) => {
            return total + path.commands.filter(cmd => cmd.type !== 'Z').length;
        }, 0);
    }

    /**
     * Get curves as polylines (connected line segments)
     * Each curve is represented as an array of points
     */
    getCurves() {
        const curves = [];

        for (let pathIndex = 0; pathIndex < this.paths.length; pathIndex++) {
            const path = this.paths[pathIndex];
            const polyline = [];
            let currentPos = { x: 0, y: 0 };

            for (let cmd of path.commands) {
                switch (cmd.type) {
                    case 'M':
                        // Start of a new polyline
                        if (polyline.length > 0) {
                            // Save previous polyline if it exists
                            curves.push({
                                points: [...polyline],
                                operation: path.operation,
                                pathIndex: pathIndex
                            });
                            polyline.length = 0;
                        }
                        currentPos = { x: cmd.coords[0], y: cmd.coords[1] };
                        polyline.push({ ...currentPos });
                        break;

                    case 'L':
                        currentPos = { x: cmd.coords[0], y: cmd.coords[1] };
                        polyline.push({ ...currentPos });
                        break;

                    case 'Z':
                        // Close the path - add first point again if needed
                        if (polyline.length > 0) {
                            const first = polyline[0];
                            const last = polyline[polyline.length - 1];
                            if (first.x !== last.x || first.y !== last.y) {
                                polyline.push({ ...first });
                            }
                        }
                        break;

                    case 'C':
                    case 'V':
                    case 'Y':
                        // For curves, just add the endpoint
                        currentPos = {
                            x: cmd.coords[cmd.coords.length - 2],
                            y: cmd.coords[cmd.coords.length - 1]
                        };
                        polyline.push({ ...currentPos });
                        break;
                }
            }

            // Add the last polyline if it has points
            if (polyline.length > 0) {
                curves.push({
                    points: polyline,
                    operation: path.operation,
                    pathIndex: pathIndex
                });
            }
        }

        return curves;
    }
}
