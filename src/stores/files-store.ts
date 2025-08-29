// Global in-memory files store for binary assets (textures, etc.)
// NOTE: We avoid putting large Blobs in zustand; this module holds them in module scope.

export type FileId = string; // sha256 hex

export type StoredFile = {
  id: FileId;
  name: string; // original or chosen file name
  mime: string;
  size: number;
  hash: string; // same as id
  blob: Blob;
};

const filesById = new Map<FileId, StoredFile>();
const nameById = new Map<FileId, string>();

async function sha256Hex(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function guessMime(name: string): string {
  const n = name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.jpg') || n.endsWith('.jpeg')) return 'image/jpeg';
  if (n.endsWith('.webp')) return 'image/webp';
  if (n.endsWith('.ktx2')) return 'image/ktx2';
  return 'application/octet-stream';
}

export async function ensureFileIdForBlob(blob: Blob, name?: string): Promise<FileId> {
  const hash = await sha256Hex(blob);
  if (!filesById.has(hash)) {
    const mime = (blob as any).type || guessMime(name || 'asset');
    const stored: StoredFile = { id: hash, name: name || 'asset', mime, size: blob.size, hash, blob };
    filesById.set(hash, stored);
    nameById.set(hash, stored.name);
  } else if (name && !nameById.get(hash)) {
    nameById.set(hash, name);
  }
  return hash;
}

export function registerFileWithId(id: FileId, blob: Blob, name: string, mime?: string): void {
  const stored: StoredFile = { id, name, mime: mime || (blob as any).type || guessMime(name), size: blob.size, hash: id, blob };
  filesById.set(id, stored);
  nameById.set(id, name);
}

export function getFile(id: FileId): StoredFile | undefined {
  return filesById.get(id);
}

export function listAllFiles(): StoredFile[] {
  return Array.from(filesById.values());
}

export function getOrCreateDownloadUrl(id: FileId): string | null {
  const sf = filesById.get(id);
  if (!sf) return null;
  const u = (sf as any)._objectUrl as string | undefined;
  if (u) return u;
  const url = URL.createObjectURL(sf.blob);
  (sf as any)._objectUrl = url;
  return url;
}

export function getSuggestedFilename(id: FileId): string | undefined {
  return nameById.get(id);
}
