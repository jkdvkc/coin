export const MAX_PHOTO_DIMENSION = 1280;

export function downscaleToDataUrl(
  file: File,
  maxDimension = MAX_PHOTO_DIMENSION,
  quality = 0.82
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Súbor sa nepodarilo načítať."));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Obrázok sa nepodarilo dekódovať."));
      img.onload = () => {
        const scale = Math.min(
          1,
          maxDimension / Math.max(img.naturalWidth, img.naturalHeight)
        );
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Canvas nie je dostupný."));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Obrázok sa nepodarilo načítať."));
    img.src = src;
  });
}
