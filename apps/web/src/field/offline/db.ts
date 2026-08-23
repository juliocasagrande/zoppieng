import { openDB, type DBSchema } from "idb";

export interface LocalAnchorPoint {
  tag: string;
  accessoryId: string | null;
  installationMode: "quimico" | "mecanico" | null;
  anchorDepthMm: number | null;
  distanceBetweenPointsMm: number | null;
  testInstrument: string | null;
  testAppliedLoadKn: number | null;
  testDurationSeconds: number | null;
  testResult: "aprovado" | "atencao" | "reprovado" | null;
  notes: string | null;
}

export interface LocalProgress {
  token: string;
  siteAddress: string;
  siteIdentification: string;
  anchorPoints: LocalAnchorPoint[];
  status: "draft" | "submitted";
  pendingSubmit: boolean;
  updatedAt: number;
}

export interface LocalPhoto {
  id: string;
  token: string;
  anchorTag: string | null;
  isExtra: boolean;
  blob: Blob;
  uploaded: boolean;
  remotePhotoId?: string;
  createdAt: number;
}

interface ZoppiFieldDB extends DBSchema {
  progress: { key: string; value: LocalProgress };
  photos: { key: string; value: LocalPhoto; indexes: { "by-token": string } };
  welcomeCache: { key: string; value: { token: string; data: unknown; cachedAt: number } };
}

const dbPromise = openDB<ZoppiFieldDB>("zoppi-field", 1, {
  upgrade(db) {
    db.createObjectStore("progress", { keyPath: "token" });
    const photoStore = db.createObjectStore("photos", { keyPath: "id" });
    photoStore.createIndex("by-token", "token");
    db.createObjectStore("welcomeCache", { keyPath: "token" });
  },
});

export async function getProgress(token: string): Promise<LocalProgress> {
  const db = await dbPromise;
  const existing = await db.get("progress", token);
  return (
    existing ?? {
      token,
      siteAddress: "",
      siteIdentification: "",
      anchorPoints: [],
      status: "draft",
      pendingSubmit: false,
      updatedAt: Date.now(),
    }
  );
}

export async function saveProgress(progress: LocalProgress): Promise<void> {
  const db = await dbPromise;
  await db.put("progress", { ...progress, updatedAt: Date.now() });
}

export async function addPhoto(photo: LocalPhoto): Promise<void> {
  const db = await dbPromise;
  await db.put("photos", photo);
}

export async function getPhotosForToken(token: string): Promise<LocalPhoto[]> {
  const db = await dbPromise;
  return db.getAllFromIndex("photos", "by-token", token);
}

export async function updatePhoto(photo: LocalPhoto): Promise<void> {
  const db = await dbPromise;
  await db.put("photos", photo);
}

export async function cacheWelcomeData(token: string, data: unknown): Promise<void> {
  const db = await dbPromise;
  await db.put("welcomeCache", { token, data, cachedAt: Date.now() });
}

export async function getCachedWelcomeData(token: string): Promise<unknown | null> {
  const db = await dbPromise;
  const entry = await db.get("welcomeCache", token);
  return entry?.data ?? null;
}
