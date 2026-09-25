export const PENDING_KIND_KEY = "qrip:pending-kind";
export const KNOWN_PHONE_KEY = "qrip:known-phone";

export type PendingDocument = {
  dataUrl: string;
  mimeType: "image/jpeg" | "application/pdf";
  fileName: string;
};

const DB_NAME = "qrip-private-documents";
const STORE_NAME = "pending";
const RECORD_KEY = "current";

function openPendingDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function savePendingDocument(document: PendingDocument) {
  const db = await openPendingDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(document, RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

export async function getPendingDocument(): Promise<PendingDocument | null> {
  const db = await openPendingDb();
  const result = await new Promise<PendingDocument | null>((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(RECORD_KEY);
    request.onsuccess = () => resolve((request.result as PendingDocument | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
  db.close();
  return result;
}

export async function clearPendingDocument() {
  const db = await openPendingDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(RECORD_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  sessionStorage.removeItem(PENDING_KIND_KEY);
}