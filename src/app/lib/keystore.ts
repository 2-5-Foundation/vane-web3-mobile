// p2p-keystore-min.ts
// Chain-agnostic CEK/KEK keystore using OPFS with IndexedDB fallback (and localStorage as last resort).

/* ======================= Types ======================= */
export type Envelope = {
  version: 1;
  scheme: 'cek-wrap-v1';
  keyId: 'libp2p-ed25519';
  origin: string;
  hkdfInfo: string;
  dataInitializationVector: number[];   // 12 bytes
  dataCiphertext: number[];             // AES-GCM(CEK, libp2p_secret)
  wraps: Wrap[];
  activeKeyIdentifier: string;
};

export type Wrap = {
  keyIdentifier: string;                // e.g. "evm:0x...", "sol:..."
  algorithm: 'signature-hkdf-aes-gcm';
  hkdfSalt: number[];                   // 16 bytes
  gcmInitializationVector: number[];    // 12 bytes
  ciphertext: number[];                 // AES-GCM(KEK, CEK)
};

/* ======================= Constants & utils ======================= */
const te = new TextEncoder();
const ORIGIN = typeof location !== 'undefined' ? location.origin : 'unknown';
const HKDF_INFO = 'vane:cek-wrap:v1:libp2p-ed25519';
const ENVELOPE_PATH = '/vane/envelope.json';
const SIGNATURE_CACHE_PATH = '/vane/signature-cache.json';

const rand = (n: number) => crypto.getRandomValues(new Uint8Array(n));

export function getKdfMessageBytes(): Uint8Array {
  // Deterministic, domain-separated payload to sign (works with any wallet that can sign bytes)
  return te.encode(JSON.stringify({ t: 'VANE_CEK_WRAP', v: 1, origin: ORIGIN, keyId: 'libp2p-ed25519' }));
}

async function hkdfSHA256(ikm: BufferSource, salt: BufferSource, info: BufferSource, len = 32) {
  const base = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt, info }, base, len * 8);
  return new Uint8Array(bits);
}

const importAES = (raw32: BufferSource, usages: KeyUsage[]) =>
  crypto.subtle.importKey('raw', raw32, { name: 'AES-GCM' }, false, usages);

async function encGCM(key: CryptoKey, iv: BufferSource, pt: BufferSource) {
  return new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, pt));
}
async function decGCM(key: CryptoKey, iv: BufferSource, ct: BufferSource) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct));
}

/* ======================= Storage: OPFS → IndexedDB → localStorage ======================= */
// OPFS root helper
async function opfsRoot(): Promise<any> {
  const navAny = navigator as any;
  if (!navAny?.storage?.getDirectory) {
    throw new Error('OPFS not supported');
  }
  return await navAny.storage.getDirectory();
}

/** ---------- Minimal IndexedDB helpers (no deps) ---------- */
type IDBJSON = { path: string; json: string };
let _dbPromise: Promise<IDBDatabase> | null = null;

function idbOpen(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('vane-opfs-fallback', 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'path' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return _dbPromise;
}

async function idbWriteJSON(path: string, obj: any): Promise<void> {
  const db = await idbOpen();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('files', 'readwrite');
    const store = tx.objectStore('files');
    store.put({ path, json: JSON.stringify(obj) } as IDBJSON);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function idbReadJSON<T>(path: string): Promise<T | null> {
  const db = await idbOpen();
  return await new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction('files', 'readonly');
    const store = tx.objectStore('files');
    const req = store.get(path);
    req.onsuccess = () => {
      const row = req.result as IDBJSON | undefined;
      if (!row) return resolve(null);
      try { resolve(JSON.parse(row.json) as T); }
      catch { resolve(null); }
    };
    req.onerror = () => reject(req.error);
  });
}

/** ---------- localStorage helpers (last resort) ---------- */
const lsKeyFor = (path: string) => `vane-opfs-fallback:${path}`;
function writeJSONLocalStorage(path: string, obj: any) {
  try { localStorage.setItem(lsKeyFor(path), JSON.stringify(obj)); } catch {}
}
function readJSONLocalStorage<T>(path: string): T | null {
  try {
    const raw = localStorage.getItem(lsKeyFor(path));
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}

/** ---------- Unified write/read with OPFS -> IndexedDB -> localStorage ---------- */
async function writeJSON(path: string, obj: any) {
  // Try OPFS first
  try {
    const root = await opfsRoot();
    const parts = path.split('/').filter(Boolean);
    const file = parts.pop()!;
    let dir = root;
    for (const p of parts) dir = await dir.getDirectoryHandle(p, { create: true });
    const fh = await dir.getFileHandle(file, { create: true }) as any;

    // Best path: SyncAccessHandle (Chromium workers; may exist)
    if (typeof fh.createSyncAccessHandle === 'function') {
      const syncHandle = await fh.createSyncAccessHandle();
      const data = new TextEncoder().encode(JSON.stringify(obj));
      syncHandle.truncate(0);
      syncHandle.write(data, { at: 0 });
      syncHandle.flush?.();
      syncHandle.close();
      return;
    }

    // Fallback path: FileSystemWritableFileStream (Chromium main thread)
    if (typeof fh.createWritable === 'function') {
      const w = await fh.createWritable();
      await w.truncate(0);
      await w.write(new Blob([JSON.stringify(obj)]));
      await w.close();
      return;
    }

    // OPFS present but no writable API → fallback
    await idbWriteJSON(path, obj);
    return;
  } catch {
    // No OPFS or write failed → IndexedDB
    try {
      await idbWriteJSON(path, obj);
      return;
    } catch {
      // Final fallback
      writeJSONLocalStorage(path, obj);
      return;
    }
  }
}

async function readJSON<T>(path: string): Promise<T | null> {
  // Try OPFS first
  try {
    const root = await opfsRoot();
    const parts = path.split('/').filter(Boolean);
    const file = parts.pop()!;
    let dir = root;
    for (const p of parts) dir = await dir.getDirectoryHandle(p);
    const fh = await dir.getFileHandle(file) as any;

    // Best path: SyncAccessHandle
    if (typeof fh.createSyncAccessHandle === 'function') {
      const syncHandle = await fh.createSyncAccessHandle();
      const size = syncHandle.getSize();
      const data = new Uint8Array(size);
      syncHandle.read(data);
      syncHandle.close();
      const text = new TextDecoder().decode(data);
      return JSON.parse(text) as T;
    }

    // Fallback path: getFile()
    if (typeof fh.getFile === 'function') {
      const blob: Blob = await fh.getFile();
      const text = await blob.text();
      return JSON.parse(text) as T;
    }

    // OPFS present but unreadable API → fall back
    const idbVal = await idbReadJSON<T>(path);
    if (idbVal !== null) return idbVal;
    return readJSONLocalStorage<T>(path);
  } catch {
    // No OPFS or read failed → IndexedDB
    const idbVal = await idbReadJSON<T>(path);
    if (idbVal !== null) return idbVal;
    return readJSONLocalStorage<T>(path);
  }
}

/* ======================= Signature Cache (on unified storage) ======================= */
type SignatureCache = Record<string, string>; // keyIdentifier -> signature hex

async function getSignatureCache(): Promise<SignatureCache> {
  const opfsCache = await readJSON<SignatureCache>(SIGNATURE_CACHE_PATH);
  return opfsCache || {};
}

async function saveSignatureCache(cache: SignatureCache): Promise<void> {
  await writeJSON(SIGNATURE_CACHE_PATH, cache);
}

export async function cacheSignature(keyIdentifier: string, signatureBytes: Uint8Array): Promise<void> {
  const cache = await getSignatureCache();
  cache[keyIdentifier] = Array.from(signatureBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  await saveSignatureCache(cache);
}

export async function getCachedSignature(keyIdentifier: string): Promise<Uint8Array | null> {
  const cache = await getSignatureCache();
  const hex = cache[keyIdentifier];
  if (!hex) return null;
  const bytes = new Uint8Array(hex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
  return bytes;
}

export async function clearSignatureCache(keyIdentifier?: string): Promise<void> {
  if (keyIdentifier) {
    const cache = await getSignatureCache();
    delete cache[keyIdentifier];
    await saveSignatureCache(cache);
  } else {
    await saveSignatureCache({});
  }
}

/* ======================= Public API (unchanged names) ======================= */

// First-time setup: create CEK, encrypt libp2p secret, add first wrap from provided signature
export async function setupKeystoreWithSignature(
  libp2pSecret32: Uint8Array,
  keyIdentifier: string,
  signatureBytes: Uint8Array
): Promise<void> {
  if (libp2pSecret32.length !== 32) throw new Error('libp2p secret must be 32 bytes');

  // CEK in RAM
  const CEK = rand(32);
  const cekKey = await importAES(CEK, ['encrypt', 'decrypt']);

  // Encrypt libp2p secret
  const dataIv = rand(12);
  const dataCt = await encGCM(cekKey, dataIv, libp2pSecret32 as BufferSource);

  // Build KEK from the signature (HKDF)
  const hkdfSalt = rand(16);
  const kekMaterial = await hkdfSHA256(signatureBytes as BufferSource, hkdfSalt, te.encode(HKDF_INFO), 32);
  const kek = await importAES(kekMaterial, ['encrypt', 'decrypt']);

  // Wrap CEK
  const wrapIv = rand(12);
  const wrapCt = await encGCM(kek, wrapIv, CEK);

  const wrap: Wrap = {
    keyIdentifier,
    algorithm: 'signature-hkdf-aes-gcm',
    hkdfSalt: Array.from(hkdfSalt),
    gcmInitializationVector: Array.from(wrapIv),
    ciphertext: Array.from(wrapCt),
  };

  const envelope: Envelope = {
    version: 1,
    scheme: 'cek-wrap-v1',
    keyId: 'libp2p-ed25519',
    origin: ORIGIN,
    hkdfInfo: HKDF_INFO,
    dataInitializationVector: Array.from(dataIv),
    dataCiphertext: Array.from(dataCt),
    wraps: [wrap],
    activeKeyIdentifier: keyIdentifier,
  };

  await writeJSON(ENVELOPE_PATH, envelope);

  // zeroize material
  CEK.fill(0);
  kekMaterial.fill(0);
}

// Load existing keystore
export async function loadEnvelopeOrThrow(): Promise<Envelope> {
  const env = await readJSON<Envelope>(ENVELOPE_PATH);
  if (!env) throw new Error('Keystore not found. Call setupKeystoreWithSignature() first.');
  return env;
}

// Derive CEK using an existing wrap + a signature you obtained externally
export async function unlockCEKWithSignature(
  envelope: Envelope,
  keyIdentifier: string,
  signatureBytes: Uint8Array
): Promise<Uint8Array> {
  const wrap = envelope.wraps.find(w => w.keyIdentifier === keyIdentifier);
  if (!wrap) throw new Error(`No wrap for ${keyIdentifier}`);

  const kekMaterial = await hkdfSHA256(
    signatureBytes as BufferSource,
    new Uint8Array(wrap.hkdfSalt),
    te.encode(envelope.hkdfInfo),
    32
  );
  const kek = await importAES(kekMaterial, ['decrypt']);
  const CEK = await decGCM(
    kek,
    new Uint8Array(wrap.gcmInitializationVector),
    new Uint8Array(wrap.ciphertext)
  );
  kekMaterial.fill(0);
  return CEK; // 32 bytes in RAM
}

// Decrypt the libp2p secret with a CEK you already unlocked
export async function decryptLibp2pSecretWithCEK(
  envelope: Envelope,
  CEK: Uint8Array
): Promise<Uint8Array> {
  const cekKey = await importAES(CEK as BufferSource, ['decrypt']);
  return decGCM(
    cekKey,
    new Uint8Array(envelope.dataInitializationVector),
    new Uint8Array(envelope.dataCiphertext)
  ); // 32 bytes
}

// Rewrap CEK from OLD wallet to NEW wallet (signatures provided by caller)
export async function addWalletWrapWithSignatures(
  envelope: Envelope,
  oldKeyIdentifier: string,
  oldSignatureBytes: Uint8Array,
  newKeyIdentifier: string,
  newSignatureBytes: Uint8Array
): Promise<Envelope> {
  // 1) Unwrap CEK with old signature
  const CEK = await unlockCEKWithSignature(envelope, oldKeyIdentifier, oldSignatureBytes);

  // 2) Create new wrap with new signature
  const hkdfSalt = rand(16);
  const kekMaterial = await hkdfSHA256(newSignatureBytes as BufferSource, hkdfSalt, te.encode(envelope.hkdfInfo), 32);
  const kek = await importAES(kekMaterial, ['encrypt']);

  const wrapIv = rand(12);
  const wrapCt = await encGCM(kek, wrapIv, CEK as BufferSource);
  kekMaterial.fill(0);

  const newWrap: Wrap = {
    keyIdentifier: newKeyIdentifier,
    algorithm: 'signature-hkdf-aes-gcm',
    hkdfSalt: Array.from(hkdfSalt),
    gcmInitializationVector: Array.from(wrapIv),
    ciphertext: Array.from(wrapCt),
  };

  const wraps = envelope.wraps.filter(w => w.keyIdentifier !== newWrap.keyIdentifier).concat([newWrap]);
  const updated: Envelope = { ...envelope, wraps, activeKeyIdentifier: newKeyIdentifier };

  await writeJSON(ENVELOPE_PATH, updated);

  // zeroize CEK
  CEK.fill(0);
  return updated;
}

/* ======================= Default export (optional) ======================= */
const keystore = {
  getKdfMessageBytes,
  setupKeystoreWithSignature,
  loadEnvelopeOrThrow,
  unlockCEKWithSignature,
  decryptLibp2pSecretWithCEK,
  addWalletWrapWithSignatures,
  cacheSignature,
  getCachedSignature,
  clearSignatureCache,
};
export default keystore;

// Ensure module-ness in strict/isolated builds even if tree-shaken:
export {};
