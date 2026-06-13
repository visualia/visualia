/**
 * Local-bytes store for dropped images (plans/import.md). A dropped File's bytes
 * live in IndexedDB keyed by content hash; the board node's `src` is just
 * `idb://<hash>`. At render the hash resolves to a session `blob:` URL through
 * the image kind's resolveSrc seam — small doc, no base64 bloat, same-origin
 * (textures in GL, no taint), and identical files dedup to one blob.
 */
const DB = 'visualia-media';
const STORE = 'blobs';

let dbP: Promise<IDBDatabase> | null = null;
function db(): Promise<IDBDatabase> {
  return (dbP ??= new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
}

function idbPut(key: string, val: Blob): Promise<void> {
  return db().then(
    (d) =>
      new Promise((res, rej) => {
        const tx = d.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(val, key);
        tx.oncomplete = () => res();
        tx.onerror = () => rej(tx.error);
      }),
  );
}

function idbGet(key: string): Promise<Blob | undefined> {
  return db().then(
    (d) =>
      new Promise((res, rej) => {
        const tx = d.transaction(STORE, 'readonly');
        const rq = tx.objectStore(STORE).get(key);
        rq.onsuccess = () => res(rq.result as Blob | undefined);
        rq.onerror = () => rej(rq.error);
      }),
  );
}

/** hash → live `blob:` URL for this session */
const urls = new Map<string, string>();

async function sha256(buf: ArrayBuffer): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Persist a blob, returning its content hash (the `idb://<hash>` body). */
export async function storeBlob(blob: Blob): Promise<string> {
  const hash = await sha256(await blob.arrayBuffer());
  if (!urls.has(hash)) {
    await idbPut(hash, blob);
    urls.set(hash, URL.createObjectURL(blob));
  }
  return hash;
}

/** resolveSrc hook: `idb://<hash>` → cached blob URL, or null for other srcs. */
export function resolveIdb(src: string): string | null {
  if (!src.startsWith('idb://')) return null;
  return urls.get(src.slice(6)) ?? src; // not yet rehydrated → returns the idb:// (won't load until ready)
}

/** Recreate blob URLs for persisted hashes after a reload. Returns true if any
    were freshly hydrated (caller should re-render). */
export async function rehydrate(hashes: string[]): Promise<boolean> {
  let any = false;
  for (const h of hashes) {
    if (urls.has(h)) continue;
    const blob = await idbGet(h).catch(() => undefined);
    if (blob) {
      urls.set(h, URL.createObjectURL(blob));
      any = true;
    }
  }
  return any;
}
