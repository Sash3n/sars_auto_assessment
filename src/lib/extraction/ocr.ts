/*
 * On-device OCR via tesseract.js. Runs entirely in the browser: the image
 * never leaves the machine. Loaded dynamically because the wasm payload is
 * large and most sessions never need it.
 */

export interface OcrResult {
  text: string;
  /** 0 to 1, from tesseract's own confidence. */
  confidence: number;
}

export async function extractImageText(
  image: Blob | ArrayBuffer,
  onProgress?: (progress: number) => void,
): Promise<OcrResult> {
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng", undefined, {
    logger: (message) => {
      if (message.status === "recognizing text" && onProgress) {
        onProgress(message.progress);
      }
    },
  });
  try {
    const blob =
      image instanceof Blob
        ? image
        : new Blob([image], { type: "application/octet-stream" });
    const {
      data: { text, confidence },
    } = await worker.recognize(blob);
    return { text, confidence: Math.max(0, Math.min(1, confidence / 100)) };
  } finally {
    await worker.terminate();
  }
}
