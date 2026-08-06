// Shrink user-picked photos before they go into storage. A raw phone photo is ~4MB, and
// FileReader.readAsDataURL inflates it another 33% as base64 — two of those blow the
// localStorage quota. Lifted from the inline version in Countdown.tsx, which was the only
// tool doing this correctly.

/** Re-encode a data URL to fit within max×max as JPEG. Returns the original on any failure. */
export function downscaleDataUrl(dataUrl: string, max: number, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > max) { height *= max / width; width = max; }
      } else {
        if (height > max) { width *= max / height; height = max; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    // Not an image, or a corrupt one — hand back what we were given rather than losing it.
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/** Read a picked File and shrink it in one step. */
export function downscaleFile(file: File, max: number, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(downscaleDataUrl(reader.result as string, max, quality));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/** Roughly how many bytes a data URL occupies in storage. */
export const dataUrlBytes = (s: string) => s.length;

/**
 * One-shot pass over images already sitting in storage from before this helper existed.
 * Only touches values above `overBytes`, so it never re-compresses an already-small image
 * (repeated JPEG round-trips visibly degrade it).
 */
export async function shrinkExisting<T>(
  items: T[],
  field: keyof T,
  max: number,
  overBytes = 200_000,
  shrink = downscaleDataUrl, // injectable so this is testable without a canvas
): Promise<{ items: T[]; changed: boolean }> {
  let changed = false;
  const out = await Promise.all(items.map(async (item) => {
    const value = item[field];
    if (typeof value !== 'string' || dataUrlBytes(value) <= overBytes) return item;
    const shrunk = await shrink(value, max);
    if (shrunk === value || shrunk.length >= value.length) return item;
    changed = true;
    return { ...item, [field]: shrunk };
  }));
  return { items: out, changed };
}
