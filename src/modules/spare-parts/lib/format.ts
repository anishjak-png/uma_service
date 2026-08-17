import { IMAGE_JPEG_QUALITY, IMAGE_MAX_EDGE } from "../constants";

async function loadImage(file: Blob): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  close: () => void;
}> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return {
      width: bitmap.width,
      height: bitmap.height,
      draw: (ctx, w, h) => ctx.drawImage(bitmap, 0, 0, w, h),
      close: () => bitmap.close(),
    };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () =>
          reject(new Error("Could not read this photo. Try JPEG from the camera."));
        img.src = url;
      });
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        draw: (ctx, w, h) => ctx.drawImage(image, 0, 0, w, h),
        close: () => undefined,
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

export async function resizeImageFile(file: Blob): Promise<Blob> {
  const image = await loadImage(file);
  try {
    const size = IMAGE_MAX_EDGE;
    const scale = Math.min(size / image.width, size / image.height);
    const drawWidth = Math.max(1, Math.round(image.width * scale));
    const drawHeight = Math.max(1, Math.round(image.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not process image");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.save();
    ctx.translate(Math.round((size - drawWidth) / 2), Math.round((size - drawHeight) / 2));
    image.draw(ctx, drawWidth, drawHeight);
    ctx.restore();
    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not compress image"))),
        "image/jpeg",
        IMAGE_JPEG_QUALITY,
      );
    });
  } finally {
    image.close();
  }
}

export function formatPrice(value: number): string {
  return `₹${Number(value).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

export function toPercent(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(1)}%`;
}
