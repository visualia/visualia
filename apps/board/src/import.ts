/**
 * Pull image Files out of a drop (plans/import.md). Handles a flat multi-file
 * drop and a whole **folder** (Chromium `webkitGetAsEntry` + recursive
 * `FileSystemDirectoryReader`). The DataTransfer is read synchronously here —
 * its items are invalid after the event tick — then traversal runs async.
 */
const IMG_EXT = /\.(png|jpe?g|gif|webp|avif|svg)$/i;
const isImage = (f: File): boolean => /^image\//.test(f.type) || IMG_EXT.test(f.name);

// minimal FileSystem entry shape (lib.dom types vary by tsconfig)
interface FsEntry {
  isFile: boolean;
  isDirectory: boolean;
  file(cb: (f: File) => void, err?: () => void): void;
  createReader(): { readEntries(cb: (e: FsEntry[]) => void, err?: () => void): void };
}

export function collectImageFiles(dt: DataTransfer): Promise<File[]> {
  // grab everything we need from the DataTransfer NOW (sync), recurse after
  const entries: FsEntry[] = [];
  const plain: File[] = [];
  if (dt.items && dt.items.length) {
    for (const it of [...dt.items]) {
      const getEntry = (it as { webkitGetAsEntry?: () => unknown }).webkitGetAsEntry;
      const e = getEntry ? (getEntry.call(it) as FsEntry | null) : null;
      if (e) entries.push(e);
    }
  }
  if (!entries.length) for (const f of [...dt.files]) plain.push(f);

  if (!entries.length) return Promise.resolve(plain.filter(isImage));

  const out: File[] = [];
  return Promise.all(entries.map((e) => walk(e, out))).then(() => out.filter(isImage));
}

function walk(entry: FsEntry, out: File[]): Promise<void> {
  return new Promise((resolve) => {
    if (entry.isFile) {
      entry.file(
        (f) => {
          out.push(f);
          resolve();
        },
        () => resolve(),
      );
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const batch: FsEntry[] = [];
      const read = (): void => {
        reader.readEntries(
          (ents) => {
            if (!ents.length) {
              void Promise.all(batch.map((e) => walk(e, out))).then(() => resolve());
              return;
            }
            batch.push(...ents);
            read(); // readEntries returns in chunks; keep calling until empty
          },
          () => resolve(),
        );
      };
      read();
    } else {
      resolve();
    }
  });
}
