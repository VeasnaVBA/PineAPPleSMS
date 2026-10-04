/**
 * Photo Service: Manages student and teacher portrait photos
 * Uses native IndexedDB Blob storage (zero Base64 bloat)
 * Ready for future Electron filesystem storage replacement.
 */

class PhotoService {
  constructor() {
    this.blobUrlCache = new Map();
  }

  /**
   * Converts a user-uploaded File to an optimized Blob (e.g. max 400x500, quality 0.82)
   */
  async processImageFile(file, options = {}) {
    return new Promise((resolve, reject) => {
      const isImage = (file.type && file.type.startsWith('image/')) || 
                      /\.(jpe?g|png|webp|bmp|gif|jfif)$/i.test(file.name || '');
      if (!isImage) {
        return reject(new Error('Selected file is not an image'));
      }

      const img = new Image();
      const reader = new FileReader();

      reader.onload = (e) => {
        img.src = e.target.result;
      };

      img.onload = () => {
        const maxWidth = options.maxWidth || 400;
        const maxHeight = options.maxHeight || 500;
        const quality = options.quality !== undefined ? options.quality : 0.82;

        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas to Blob conversion failed'));
        }, 'image/jpeg', quality);
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get an object URL for a given Blob
   */
  getUrlForBlob(blob) {
    if (!blob) return null;
    if (this.blobUrlCache.has(blob)) {
      return this.blobUrlCache.get(blob);
    }
    const url = URL.createObjectURL(blob);
    this.blobUrlCache.set(blob, url);
    return url;
  }

  /**
   * Release cached object URLs
   */
  revokeUrl(blob) {
    if (this.blobUrlCache.has(blob)) {
      URL.revokeObjectURL(this.blobUrlCache.get(blob));
      this.blobUrlCache.delete(blob);
    }
  }
}

export const photoService = new PhotoService();
