import type { Workspace } from '@/lib/types';
import type { DataAdapter } from './adapter';

/* Zero setup: everything in this browser. A 320px JPEG headshot is stored as
   a data URL so the page can show it without a server. */
const KEY = 'frontdoor.web.v1';

function shrink(file: Blob, max = 320): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('That did not look like an image.'));
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.84));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function localAdapter(): DataAdapter {
  return {
    kind: 'local',
    async load() {
      try {
        const raw = window.localStorage.getItem(KEY);
        return raw ? (JSON.parse(raw) as Workspace) : null;
      } catch {
        return null;
      }
    },
    async save(ws) {
      try {
        window.localStorage.setItem(KEY, JSON.stringify(ws));
      } catch (e) {
        const full = e instanceof DOMException && /quota/i.test(e.name);
        throw new Error(full ? 'This browser is full. Remove a photo or a company to keep saving.' : 'This browser will not let us save.');
      }
    },
    storePhoto: (file) => shrink(file),
    async storeResume() {
      return null;
    },
    async clear() {
      try {
        window.localStorage.removeItem(KEY);
      } catch {
        /* nothing to clear */
      }
    },
  };
}
