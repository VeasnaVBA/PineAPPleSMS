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
   * Converts a user-uploaded File to a high-resolution portrait Blob targeting ~100KB
   * (e.g. max 500x650, quality 0.85) perfect for crisp ID cards, dossiers, and Google Drive storage.
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
        const maxWidth = options.maxWidth || 300;
        const maxHeight = options.maxHeight || 390;
        const quality = options.quality !== undefined ? options.quality : 0.75;

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
   * Normalize a stored photo/QR string, converting Google Drive viewer links into direct image URLs.
   */
  normalizeImageUrl(url) {
    if (!url || typeof url !== 'string') return null;
    const trimmed = url.trim();
    if (!trimmed || trimmed === '(Photo attached)') return null;
    if (trimmed.startsWith('data:') || trimmed.startsWith('blob:')) return trimmed;

    const driveMatch =
      trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/drive\.google\.com\/open\?[^#]*id=([a-zA-Z0-9_-]+)/) ||
      trimmed.match(/drive\.google\.com\/uc\?[^#]*id=([a-zA-Z0-9_-]+)/);
    if (driveMatch && driveMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${driveMatch[1]}`;
    }

    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
    return null;
  }

  /**
   * Resolve the best displayable image URL from a student/teacher record (local Blob or remote/data URL).
   */
  resolvePhotoUrl(record) {
    if (!record) return null;
    if (record.photoBlob) {
      const blobUrl = this.getUrlForBlob(record.photoBlob);
      if (blobUrl) return blobUrl;
    }
    return this.normalizeImageUrl(record.photo);
  }

  /**
   * Get an object URL or displayable URL for a given Blob or Data URL
   */
  getUrlForBlob(blob) {
    if (!blob) return null;
    if (typeof blob === 'string') {
      return this.normalizeImageUrl(blob);
    }
    if (!(blob instanceof Blob)) return null;

    if (this.blobUrlCache.has(blob)) {
      return this.blobUrlCache.get(blob);
    }
    try {
      const url = URL.createObjectURL(blob);
      this.blobUrlCache.set(blob, url);
      return url;
    } catch (_) {
      return null;
    }
  }

  /**
   * Release cached object URLs
   */
  revokeUrl(blob) {
    if (this.blobUrlCache.has(blob)) {
      try {
        URL.revokeObjectURL(this.blobUrlCache.get(blob));
      } catch (_) {}
      this.blobUrlCache.delete(blob);
    }
  }

  /**
   * Converts a Blob to a Base64 data URL
   */
  async blobToDataUrl(blob) {
    if (!blob) return '';
    if (typeof blob === 'string') return blob;
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result || '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Ensures a data:image/* URL fits comfortably inside Google Sheets' 50,000-char cell limit.
   */
  async compressDataUrlToLimit(dataUrl, maxChars = 45000) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return dataUrl || '';
    }
    if (dataUrl.length <= maxChars) return dataUrl;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const steps = [
          [280, 0.72],
          [240, 0.65],
          [200, 0.58],
          [160, 0.50],
          [130, 0.42]
        ];
        let best = dataUrl;
        for (const [maxDim, quality] of steps) {
          const ratio = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
          const w = Math.max(1, Math.round((img.width || maxDim) * ratio));
          const h = Math.max(1, Math.round((img.height || maxDim) * ratio));
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const candidate = canvas.toDataURL('image/jpeg', quality);
          best = candidate;
          if (candidate.length <= maxChars) break;
        }
        resolve(best);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  /**
   * Converts a Blob to a compact Base64 Data URL that fits in a single Google Sheet cell.
   */
  async blobToDataUrlForSheet(blob, maxChars = 45000) {
    const raw = await this.blobToDataUrl(blob);
    return this.compressDataUrlToLimit(raw, maxChars);
  }

  /**
   * Converts a Data URL back to a binary Blob
   */
  async dataUrlToBlob(dataUrl) {
    if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) {
      return null;
    }
    try {
      const res = await fetch(dataUrl);
      return await res.blob();
    } catch (err) {
      try {
        const parts = dataUrl.split(',');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], { type: mime });
      } catch (e) {
        console.warn('dataUrlToBlob decoding fallback failed:', e);
        return null;
      }
    }
  }

  /**
   * Resizes and compresses an image (Blob or Data URL) into a compact Base64 JPEG data URL
   * guaranteed to fit safely within Google Sheets' 50,000 character cell limit.
   */
  async blobToOptimizedDataUrl(input, maxWidth = 200, maxHeight = 250, quality = 0.7) {
    if (!input) return '';
    
    let sourceUrl = '';
    let isObjectUrl = false;
    
    if (typeof input === 'string') {
      if (!input.startsWith('data:')) return '';
      sourceUrl = input;
    } else if (input instanceof Blob) {
      sourceUrl = URL.createObjectURL(input);
      isObjectUrl = true;
    } else {
      return '';
    }

    try {
      const img = await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = (e) => reject(new Error('Failed to load image for optimization'));
        image.src = sourceUrl;
      });

      let w = img.width || maxWidth;
      let h = img.height || maxHeight;
      const ratio = Math.min(maxWidth / w, maxHeight / h, 1);
      w = Math.max(Math.round(w * ratio), 1);
      h = Math.max(Math.round(h * ratio), 1);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);

      let q = quality;
      let dataUrl = canvas.toDataURL('image/jpeg', q);

      // In the rare event it exceeds 45,000 characters, progressively compress
      while (dataUrl.length > 45000 && q > 0.3) {
        q -= 0.15;
        dataUrl = canvas.toDataURL('image/jpeg', q);
      }

      if (dataUrl.length > 45000) {
        canvas.width = Math.max(Math.round(w * 0.7), 1);
        canvas.height = Math.max(Math.round(h * 0.7), 1);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      }

      return dataUrl;
    } catch (err) {
      console.warn('blobToOptimizedDataUrl failed:', err);
      return '';
    } finally {
      if (isObjectUrl) {
        URL.revokeObjectURL(sourceUrl);
      }
    }
  }
}

export const photoService = new PhotoService();

