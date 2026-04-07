/**
 * UnPlotter - PDF Data Extractor
 * Copyright (c) 2025 Robert McDonald
 * Licensed under the MIT License
 * See LICENSE file in the project root for full license information.
 */

// PDF.js ImageKind constants (from pdfjs-dist/src/shared/util.js)
const ImageKind = {
    GRAYSCALE_1BPP: 1,
    RGB_24BPP: 2,
    RGBA_32BPP: 3,
};

export class ImageExtractor {
    constructor(pdfLoader) {
        this.pdfLoader = pdfLoader;
    }

    applyTransform(x, y, transform) {
        const [a, b, c, d, e, f] = transform;
        return {
            x: a * x + c * y + e,
            y: b * x + d * y + f
        };
    }

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

    /**
     * Compute the four corners of a PDF image in PDF-space coordinates.
     * An image XObject occupies a [0,0]–[1,1] unit square; the CTM maps
     * that square to the page coordinate space.
     */
    computeImageBounds(ctm) {
        return {
            p0: this.applyTransform(0, 0, ctm),  // bottom-left  in PDF space
            p1: this.applyTransform(1, 0, ctm),  // bottom-right
            p2: this.applyTransform(1, 1, ctm),  // top-right
            p3: this.applyTransform(0, 1, ctm),  // top-left
        };
    }

    /**
     * Walk the operator list and return lightweight metadata for every raster
     * image found on the page.  Only width/height and position are stored —
     * no pixel buffers, no OffscreenCanvases.  Pixel data is fetched on demand
     * via exportImageAsPNG().
     *
     * pageNum is stored in each descriptor so that exportImageAsPNG() can
     * re-fetch the page from the PDF document when needed.
     *
     * Inline images (paintInlineImageXObject) are a special case: their pixel
     * data lives only in the operator-list args, so it is retained here (it is
     * not fetchable later from page.objs).
     */
    async extractImages(page, pageNum) {
        const OPS = this.pdfLoader.OPS;
        if (!OPS) return [];

        let operatorList;
        try {
            operatorList = await page.getOperatorList();
        } catch (e) {
            console.error('ImageExtractor: getOperatorList failed', e);
            return [];
        }


        const imageRefs = [];
        const transformStack = [];
        let currentTransform = [1, 0, 0, 1, 0, 0]; // identity CTM

        for (let i = 0; i < operatorList.fnArray.length; i++) {
            const fn   = operatorList.fnArray[i];
            const args = operatorList.argsArray[i];

            switch (fn) {
                case OPS.save:
                    transformStack.push([...currentTransform]);
                    break;

                case OPS.restore:
                    if (transformStack.length > 0) {
                        currentTransform = transformStack.pop();
                    }
                    break;

                case OPS.transform:
                    currentTransform = this.multiplyTransforms(currentTransform, args);
                    break;

                case OPS.paintImageXObject:
                case OPS.paintImageXObjectRepeat:
                    imageRefs.push({
                        name:     args[0],
                        isInline: false,
                        isMask:   false,
                        pageNum,
                        ctm:      [...currentTransform],
                        bounds:   this.computeImageBounds([...currentTransform]),
                        // width/height filled in below via page.objs probe
                        width: 0,
                        height: 0,
                        // No pixel data stored — fetched on demand at export time.
                        inlineData: null,
                    });
                    break;

                case OPS.paintImageMaskXObject:
                case OPS.paintImageMaskXObjectRepeat: {
                    // args[0] is a descriptor: {width, height, data, ...}
                    // Two forms are possible in PDF.js:
                    //   • data is a string key → pixel data lives in page.objs[key]
                    //   • data is a typed array → truly inline pixel data
                    const md = args[0];
                    if (md && typeof md.data === 'string') {
                        // Reference form: data is the page.objs lookup key.
                        // Width/height come from the descriptor itself.
                        imageRefs.push({
                            name:       md.data,   // the key string for page.objs
                            isInline:   false,
                            isMask:     true,
                            pageNum,
                            ctm:        [...currentTransform],
                            bounds:     this.computeImageBounds([...currentTransform]),
                            width:      md.width  ?? 0,
                            height:     md.height ?? 0,
                            inlineData: null,
                        });
                    } else {
                        // Truly inline 1-bit pixel data.
                        imageRefs.push({
                            name:       null,
                            isInline:   true,
                            isMask:     true,
                            pageNum,
                            ctm:        [...currentTransform],
                            bounds:     this.computeImageBounds([...currentTransform]),
                            width:      md?.width  ?? 0,
                            height:     md?.height ?? 0,
                            inlineData: md,
                        });
                    }
                    break;
                }

                case OPS.paintInlineImageXObject:
                    // Inline image data is only available in the operator-list args;
                    // it cannot be retrieved later from page.objs.  Keep it now.
                    // The data object is small relative to named XObjects because
                    // inline images are rarely used for large bitmaps.
                    imageRefs.push({
                        name:       null,
                        isInline:   true,
                        pageNum,
                        ctm:        [...currentTransform],
                        bounds:     this.computeImageBounds([...currentTransform]),
                        width:      args[0]?.width  ?? 0,
                        height:     args[0]?.height ?? 0,
                        inlineData: args[0],       // {width, height, data, kind}
                    });
                    break;

                case OPS.paintFormXObjectBegin:
                    // args[0] = form transformation matrix (may be null)
                    // args[1] = bounding box (not a transform matrix — do not use)
                    // Always push so paintFormXObjectEnd has a balanced pop.
                    transformStack.push([...currentTransform]);
                    if (Array.isArray(args[0]) && args[0].length === 6) {
                        currentTransform = this.multiplyTransforms(currentTransform, args[0]);
                    }
                    break;

                case OPS.paintFormXObjectEnd:
                    if (transformStack.length > 0) {
                        currentTransform = transformStack.pop();
                    }
                    break;

                default:
                    break;
            }
        }

        // For named XObjects, probe page.objs to discover width/height only.
        // We do NOT store the ImageBitmap or pixel buffer; those are fetched
        // on demand when the user saves.  The probe itself is cheap — page.objs
        // already holds the decoded object; we just read its dimensions.
        const probePromises = imageRefs
            .filter(ref => !ref.isInline && ref.name)
            .map(ref => new Promise(resolve => {
                try {
                    page.objs.get(ref.name, data => {
                        if (data) {
                            ref.width  = data.width  ?? 0;
                            ref.height = data.height ?? 0;
                        }
                        resolve();
                    });
                } catch (e) {
                    console.warn(`ImageExtractor: could not probe "${ref.name}"`, e);
                    resolve();
                }
            }));

        await Promise.all(probePromises);

        const images = imageRefs.filter(ref => ref.width > 0 && ref.height > 0);
        console.log(`ImageExtractor: found ${images.length} raster image(s) on page`);
        return images;
    }

    /**
     * Fetch a named image XObject's pixel data on demand and return it.
     *
     * PDF.js 4.x stores decoded images as ImageBitmap objects in page.objs.
     * The bitmap is closed by PDF.js after rendering (to free GPU memory), so
     * we cannot rely on it still being valid at save time.  When it has been
     * closed we force a fresh decode by calling page.cleanup() followed by
     * page.getOperatorList(), which causes PDF.js to re-parse the image stream
     * and place a new, open ImageBitmap back into page.objs.
     */
    async _fetchNamedImageData(name, pageNum) {
        const pdfDoc = this.pdfLoader.pdfDocument;
        if (!pdfDoc) throw new Error('No PDF document loaded');

        const page = await pdfDoc.getPage(pageNum);

        // First attempt: trigger resource loading and read from cache.
        await page.getOperatorList();

        let imgData = await new Promise(resolve => page.objs.get(name, resolve));

        // Test whether the ImageBitmap (if present) is still usable.
        // PDF.js may return the bitmap directly OR wrapped in {bitmap, width, height, ...}.
        const bitmap = (imgData instanceof ImageBitmap) ? imgData : imgData?.bitmap;
        if (bitmap instanceof ImageBitmap) {
            const valid = await this._bitmapIsUsable(bitmap);
            if (valid) return imgData;

            // The bitmap was closed by a prior render.  Re-parse the stream.
            console.log(`ImageExtractor: bitmap for "${name}" was detached — re-parsing page ${pageNum}`);
            page.cleanup();
            await page.getOperatorList();
            imgData = await new Promise(resolve => page.objs.get(name, resolve));
        }

        return imgData;
    }

    /** True if the ImageBitmap can still be drawn (i.e. has not been closed). */
    async _bitmapIsUsable(bitmap) {
        try {
            const test = new OffscreenCanvas(1, 1);
            test.getContext('2d').drawImage(bitmap, 0, 0, 1, 1, 0, 0, 1, 1);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Export the image described by imageRef as a lossless PNG Blob.
     *
     * The pixel data is fetched from the PDF on demand here — nothing is
     * pre-allocated at page-load time.  A single OffscreenCanvas is created
     * for the duration of this call and is garbage-collected once the Blob
     * has been produced.
     *
     * Why OffscreenCanvas for ImageBitmap?  The ImageBitmap API intentionally
     * does not expose raw pixel bytes — drawing to a canvas is the only
     * browser-standard way to access them.  The canvas is required to both
     * read the pixels AND to obtain PNG-encoded output via convertToBlob().
     */
    async exportImageAsPNG(imageRef) {
        // ── Inline images (including mask images) ───────────────────────────
        if (imageRef.isInline) {
            const d = imageRef.inlineData;
            if (!d) throw new Error('Inline image has no stored data');
            if (d.bitmap instanceof ImageBitmap) {
                const offscreen = new OffscreenCanvas(d.width, d.height);
                offscreen.getContext('2d').drawImage(d.bitmap, 0, 0);
                return offscreen.convertToBlob({ type: 'image/png' });
            }
            if (imageRef.isMask) {
                return this._maskDataToBlob(d);
            }
            if (!d.kind) throw new Error(`Unsupported inline image: kind is missing`);
            return this._rawDataToBlob(d.width, d.height, d.data, d.kind);
        }

        // ── Named XObject images (on-demand fetch) ──────────────────────────
        const { name, pageNum, width, height, isMask } = imageRef;
        const imgData = await this._fetchNamedImageData(name, pageNum);

        if (!imgData) throw new Error(`Image "${name}" could not be retrieved from the PDF`);

        // imgData can come back as an ImageBitmap directly OR as a wrapper object.
        const bitmap = (imgData instanceof ImageBitmap) ? imgData : imgData?.bitmap;

        if (bitmap instanceof ImageBitmap) {
            const w = imgData?.width || width;
            const h = imgData?.height || height;
            const offscreen = new OffscreenCanvas(w, h);
            offscreen.getContext('2d').drawImage(bitmap, 0, 0);
            return offscreen.convertToBlob({ type: 'image/png' });
        }

        if (imgData?.data) {
            const w = imgData.width  || width;
            const h = imgData.height || height;
            if (isMask) {
                return this._maskDataToBlob({
                    width: w, height: h,
                    data: imgData.data,
                    inverseDecode: imgData.inverseDecode,
                });
            }
            const kind = imgData.kind ?? ImageKind.RGB_24BPP;
            return this._rawDataToBlob(w, h, imgData.data, kind);
        }

        throw new Error(`Image "${name}" has neither an ImageBitmap nor raw pixel data`);
    }

    /**
     * Convert a PDF image-mask data object to a greyscale PNG Blob.
     *
     * PDF image masks are 1-bit stencils: bit=1 means "paint foreground here",
     * bit=0 means "show background".  We render them as black-on-white images
     * (foreground=black, background=white), which matches how they look on a
     * typical printed page.
     *
     * Two data layouts are handled:
     *   • Packed 1-bit per pixel (GRAYSCALE_1BPP): data.length ≈ ⌈w/8⌉ × h
     *   • 1 byte per pixel (expanded grayscale): data.length ≈ w × h
     *
     * The optional `inverseDecode` flag on the data object inverts the mapping.
     */
    async _maskDataToBlob(d) {
        const { width, height, data, inverseDecode } = d;
        const rgbaData = new Uint8ClampedArray(width * height * 4);
        const packedLen = Math.ceil(width / 8) * height;
        const isPacked  = data.length <= packedLen * 1.1; // allow small tolerance

        // foreground pixel value: bit=1 means "paint", rendered as black (0)
        // inverseDecode flips this: bit=0 means "paint"
        const fgBit = inverseDecode ? 0 : 1;

        if (isPacked) {
            const bytesPerRow = Math.ceil(width / 8);
            for (let row = 0; row < height; row++) {
                for (let col = 0; col < width; col++) {
                    const byteIdx = row * bytesPerRow + Math.floor(col / 8);
                    const bitIdx  = 7 - (col % 8);
                    const bit     = (data[byteIdx] >> bitIdx) & 1;
                    const v       = bit === fgBit ? 0 : 255; // foreground=black, background=white
                    const out     = (row * width + col) * 4;
                    rgbaData[out] = rgbaData[out + 1] = rgbaData[out + 2] = v;
                    rgbaData[out + 3] = 255;
                }
            }
        } else {
            // Byte-per-pixel: each byte is 0 (background) or 255 (foreground),
            // or an intermediate greyscale value.
            for (let i = 0; i < width * height; i++) {
                const isFg = inverseDecode ? data[i] === 0 : data[i] !== 0;
                const v    = isFg ? 0 : 255;
                const out  = i * 4;
                rgbaData[out] = rgbaData[out + 1] = rgbaData[out + 2] = v;
                rgbaData[out + 3] = 255;
            }
        }

        const offscreen = new OffscreenCanvas(width, height);
        offscreen.getContext('2d').putImageData(new ImageData(rgbaData, width, height), 0, 0);
        return offscreen.convertToBlob({ type: 'image/png' });
    }

    /**
     * Convert a raw pixel buffer (with a PDF.js ImageKind tag) to a PNG Blob
     * via an OffscreenCanvas.  An OffscreenCanvas is still needed here because
     * convertToBlob() is the browser's built-in PNG encoder — implementing
     * deflate + CRC32 + PNG chunk framing manually would add significant
     * complexity for no practical gain.
     */
    async _rawDataToBlob(width, height, data, kind) {
        let rgbaData;

        switch (kind) {
            case ImageKind.RGBA_32BPP:
                rgbaData = new Uint8ClampedArray(
                    data.buffer
                        ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength)
                        : data
                );
                break;

            case ImageKind.RGB_24BPP: {
                rgbaData = new Uint8ClampedArray(width * height * 4);
                for (let i = 0, j = 0; i < data.length; i += 3, j += 4) {
                    rgbaData[j]     = data[i];
                    rgbaData[j + 1] = data[i + 1];
                    rgbaData[j + 2] = data[i + 2];
                    rgbaData[j + 3] = 255;
                }
                break;
            }

            case ImageKind.GRAYSCALE_1BPP: {
                const bytesPerRow = Math.ceil(width / 8);
                rgbaData = new Uint8ClampedArray(width * height * 4);
                for (let row = 0; row < height; row++) {
                    for (let col = 0; col < width; col++) {
                        const byteIdx = row * bytesPerRow + Math.floor(col / 8);
                        const bitIdx  = 7 - (col % 8);
                        const v       = ((data[byteIdx] >> bitIdx) & 1) ? 255 : 0;
                        const out     = (row * width + col) * 4;
                        rgbaData[out]     = v;
                        rgbaData[out + 1] = v;
                        rgbaData[out + 2] = v;
                        rgbaData[out + 3] = 255;
                    }
                }
                break;
            }

            default:
                throw new Error(`Unsupported image kind: ${kind}`);
        }

        const offscreen = new OffscreenCanvas(width, height);
        offscreen.getContext('2d').putImageData(new ImageData(rgbaData, width, height), 0, 0);
        return offscreen.convertToBlob({ type: 'image/png' });
    }
}
