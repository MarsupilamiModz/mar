export type CroppedAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CropOutputSize =
  | number
  | { width: number; height: number };

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

function resolveOutputSize(outputSize: CropOutputSize) {
  if (typeof outputSize === "number") {
    return { width: outputSize, height: outputSize };
  }
  return outputSize;
}

/** Crop image to blob via canvas. Supports rotation in degrees and non-square output. */
export async function getCroppedImageBlob(
  imageSrc: string,
  pixelCrop: CroppedAreaPixels,
  outputSize: CropOutputSize = 512,
  mime: "image/jpeg" | "image/png" | "image/webp" = "image/jpeg",
  rotation = 0
): Promise<Blob> {
  const { width: outputWidth, height: outputHeight } = resolveOutputSize(outputSize);
  const image = await createImage(imageSrc);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas not supported");

  const rotRad = (rotation * Math.PI) / 180;

  if (rotation !== 0) {
    const maxSize = Math.max(image.width, image.height);
    const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));
    canvas.width = safeArea;
    canvas.height = safeArea;
    ctx.translate(safeArea / 2, safeArea / 2);
    ctx.rotate(rotRad);
    ctx.translate(-image.width / 2, -image.height / 2);
    ctx.drawImage(image, 0, 0);
  } else {
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      outputWidth,
      outputHeight
    );
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
        mime,
        0.92
      );
    });
  }

  const croppedCanvas = document.createElement("canvas");
  croppedCanvas.width = outputWidth;
  croppedCanvas.height = outputHeight;
  const croppedCtx = croppedCanvas.getContext("2d");
  if (!croppedCtx) throw new Error("Canvas not supported");

  croppedCtx.drawImage(
    canvas,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  return new Promise((resolve, reject) => {
    croppedCanvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Crop failed"))),
      mime,
      0.92
    );
  });
}
