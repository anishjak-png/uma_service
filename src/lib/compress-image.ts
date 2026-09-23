const MAX_EDGE = 1280;
const JPEG_QUALITY = 0.72;
const SKIP_IF_SMALLER_THAN = 250_000;

async function loadImage(file: Blob): Promise<{
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  close: () => void;
}> {
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
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

/** Shrink a camera photo for faster job save. Keeps aspect ratio. */
export async function compressJobPhoto(file: File): Promise<File> {
  if (file.size <= SKIP_IF_SMALLER_THAN && file.type === "image/jpeg") {
    return file;
  }

  try {
    const image = await loadImage(file);
    try {
      const scale = Math.min(1, MAX_EDGE / Math.max(image.width, image.height));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      image.draw(ctx, width, height);
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY);
      });
      if (!blob || blob.size >= file.size) return file;
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], name, { type: "image/jpeg" });
    } finally {
      image.close();
    }
  } catch {
    return file;
  }
}

export async function compressJobPhotos(files: File[]): Promise<File[]> {
  return Promise.all(files.map((file) => compressJobPhoto(file)));
}
