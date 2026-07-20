/**
 * =======================================================
 * BananaLeafDetect - YOLOv8 TFLite Web Inference Helper
 * =======================================================
 */

class BananaYoloModel {
    constructor() {
        this.model = null;
        this.isLoaded = false;
        // The 7 banana leaf disease classes in metadata
        this.classes = {
            0: "Banana Black Sigatoka Disease",
            1: "Banana Bract Mosaic Virus Disease",
            2: "Banana Healthy Leaf",
            3: "Banana Insect Pest Disease",
            4: "Banana Moko Disease",
            5: "Banana Panama Disease",
            6: "Banana Yellow Sigatoka Disease"
        };
    }

    /**
     * Download the TFLite model from path with progress tracking,
     * and load it using tfjs-tflite.
     * @param {string} modelUrl 
     * @param {function} onProgress (progressVal) - returns value from 0 to 1
     */
    async loadModel(modelUrl, onProgress) {
        try {
            // First fetch the model file with progress tracking
            const response = await this.fetchWithProgress(modelUrl, onProgress);
            
            // Set WASM paths for tfjs-tflite (important for browser loading)
            if (window.tflite) {
                // Point to CDN jsdelivr for the tfjs-tflite WASM files
                tflite.setWasmPath('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-tflite@0.0.1-alpha.10/dist/');
                
                // Load model from ArrayBuffer
                console.log("Memuat model ArrayBuffer ke tfjs-tflite...");
                this.model = await tflite.loadTFLiteModel(response);
                this.isLoaded = true;
                console.log("Model AI YOLOv8 Berhasil Dimuat!");
                return true;
            } else {
                throw new Error("tfjs-tflite library not loaded");
            }
        } catch (error) {
            console.error("Gagal memuat model TFLite:", error);
            this.isLoaded = false;
            return false;
        }
    }

    /**
     * Helper to fetch file with progress events
     */
    fetchWithProgress(url, onProgress) {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.responseType = 'arraybuffer';

            xhr.onprogress = (event) => {
                if (event.lengthComputable) {
                    const percentComplete = event.loaded / event.total;
                    if (onProgress) onProgress(percentComplete);
                }
            };

            xhr.onload = () => {
                if (xhr.status === 200) {
                    if (onProgress) onProgress(1.0); // Complete
                    resolve(xhr.response);
                } else {
                    reject(new Error(`Failed to load file. Status: ${xhr.status}`));
                }
            };

            xhr.onerror = () => {
                reject(new Error('Network error during file download'));
            };

            xhr.send();
        });
    }

    /**
     * Preprocess input image to shape [1, 3, 640, 640] (NCHW) normalized to [0, 1]
     * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} sourceElement 
     * @returns {tf.Tensor} Preprocessed input tensor
     */
    preprocess(sourceElement) {
        return tf.tidy(() => {
            // 1. Convert pixel values to tf.Tensor [H, W, 3]
            let imgTensor = tf.browser.fromPixels(sourceElement);

            // 2. Resize to 640x640 using bilinear interpolation
            imgTensor = tf.image.resizeBilinear(imgTensor, [640, 640]);

            // 3. Normalize values from [0, 255] to [0.0, 1.0]
            imgTensor = imgTensor.div(tf.scalar(255.0));

            // 4. Permute dimensions from NHWC (channels last) to NCHW (channels first)
            // [640, 640, 3] -> [3, 640, 640]
            imgTensor = imgTensor.transpose([2, 0, 1]);

            // 5. Expand dims to add Batch dimension: [1, 3, 640, 640]
            return imgTensor.expandDims(0);
        });
    }

    /**
     * Run prediction on the input element
     * @param {HTMLImageElement|HTMLVideoElement|HTMLCanvasElement} sourceElement 
     * @param {number} confThreshold Confidence threshold (0.0 to 1.0)
     * @param {number} iouThreshold NMS IoU threshold (0.0 to 1.0)
     * @returns {Promise<Array>} List of detected boxes: [{box: [x1,y1,x2,y2], score, classId, className}]
     */
    async detect(sourceElement, confThreshold = 0.25, iouThreshold = 0.45) {
        if (!this.model) {
            throw new Error("Model AI belum dimuat");
        }

        // 1. Run Preprocessing
        const inputTensor = this.preprocess(sourceElement);

        // 2. Inference
        // predict returns a tensor or map of tensors.
        // For YOLOv8, it outputs a single tensor of shape [1, 11, 8400]
        const outputTensor = this.model.predict(inputTensor);
        
        // Cleanup input tensor
        inputTensor.dispose();

        // 3. Extract output data
        // Output tensor shape is [1, 11, 8400]
        const outputData = await outputTensor.data();
        outputTensor.dispose();

        // 4. Parse output (11 channels, 8400 anchors)
        const numClasses = 7;
        const numAnchors = 8400;
        
        // Subarray pointers for coordinates in Float32Array (row-major order)
        // x_center, y_center, width, height are channels 0, 1, 2, 3
        const xCenters = outputData.subarray(0, numAnchors);
        const yCenters = outputData.subarray(numAnchors, numAnchors * 2);
        const widths = outputData.subarray(numAnchors * 2, numAnchors * 3);
        const heights = outputData.subarray(numAnchors * 3, numAnchors * 4);

        const candidates = [];

        for (let i = 0; i < numAnchors; i++) {
            let maxScore = 0;
            let classId = -1;

            // Check probability of each class (channels 4 to 10)
            for (let c = 0; c < numClasses; c++) {
                const score = outputData[(4 + c) * numAnchors + i];
                if (score > maxScore) {
                    maxScore = score;
                    classId = c;
                }
            }

            // Filter by confidence threshold
            if (maxScore > confThreshold) {
                const cx = xCenters[i];
                const cy = yCenters[i];
                const w = widths[i];
                const h = heights[i];

                // Scale of bounding boxes coordinates in model output is [0, 640]
                // Convert center-based to corner-based coordinates: x1, y1, x2, y2 (relative to 640x640 input)
                const x1 = cx - w / 2;
                const y1 = cy - h / 2;
                const x2 = cx + w / 2;
                const y2 = cy + h / 2;

                candidates.push({
                    box: [x1, y1, x2, y2],
                    score: maxScore,
                    classId: classId,
                    className: this.classes[classId]
                });
            }
        }

        // 5. Apply Non-Maximum Suppression (NMS)
        const finalDetections = this.nonMaxSuppression(candidates, iouThreshold);
        return finalDetections;
    }

    /**
     * Compute Intersection over Union (IoU) of two boxes
     */
    iou(box1, box2) {
        const [x1_1, y1_1, x2_1, y2_1] = box1;
        const [x1_2, y1_2, x2_2, y2_2] = box2;

        const x1_i = Math.max(x1_1, x1_2);
        const y1_i = Math.max(y1_1, y1_2);
        const x2_i = Math.min(x2_1, x2_2);
        const y2_i = Math.min(y2_1, y2_2);

        const interArea = Math.max(0, x2_i - x1_i) * Math.max(0, y2_i - y1_i);
        const box1Area = (x2_1 - x1_1) * (y2_1 - y1_1);
        const box2Area = (x2_2 - x1_2) * (y2_2 - y1_2);
        const unionArea = box1Area + box2Area - interArea;

        return unionArea > 0 ? interArea / unionArea : 0;
    }

    /**
     * Class-specific Non-Maximum Suppression
     */
    nonMaxSuppression(candidates, iouThreshold) {
        // Sort by confidence score descending
        candidates.sort((a, b) => b.score - a.score);

        const selected = [];
        const active = new Array(candidates.length).fill(true);

        for (let i = 0; i < candidates.length; i++) {
            if (!active[i]) continue;

            selected.push(candidates[i]);

            for (let j = i + 1; j < candidates.length; j++) {
                if (!active[j]) continue;

                // Class-specific NMS
                if (candidates[i].classId === candidates[j].classId) {
                    const overlap = this.iou(candidates[i].box, candidates[j].box);
                    if (overlap > iouThreshold) {
                        active[j] = false;
                    }
                }
            }
        }

        return selected;
    }
}
