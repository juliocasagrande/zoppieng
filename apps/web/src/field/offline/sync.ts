import { publicApi } from "../../lib/api.js";
import { getPhotosForToken, getProgress, saveProgress, updatePhoto, type LocalPhoto } from "./db.js";

// Uploads any photos captured while offline (or just not yet uploaded), then
// — if the local submission is marked "draft" but the user tapped submit
// while offline — pushes the final submission. Safe to call repeatedly
// (idempotent): already-uploaded photos and already-submitted reports are
// skipped.
export async function syncToken(token: string): Promise<{ uploaded: number; submitted: boolean }> {
  const photos = await getPhotosForToken(token);
  let uploaded = 0;

  for (const photo of photos.filter((p) => !p.uploaded)) {
    try {
      const remoteId = await uploadPhoto(token, photo);
      await updatePhoto({ ...photo, uploaded: true, remotePhotoId: remoteId });
      uploaded++;
    } catch {
      // Leave unuploaded; next sync attempt (online event / retry button) will retry.
    }
  }

  const progress = await getProgress(token);
  let submitted = false;
  if (progress.status === "submitted") {
    submitted = true;
  } else if (progress.status === "draft" && progress.pendingSubmit) {
    const allUploaded = (await getPhotosForToken(token)).every((p) => p.uploaded);
    if (allUploaded) {
      await submitReport(token);
      await saveProgress({ ...progress, status: "submitted" });
      submitted = true;
    }
  }

  return { uploaded, submitted };
}

async function uploadPhoto(token: string, photo: LocalPhoto): Promise<string> {
  const { path, signedUrl } = await publicApi.post(`/field/${token}/photos/upload-url`, { ext: "jpg" });
  await fetch(signedUrl, { method: "PUT", body: photo.blob, headers: { "Content-Type": "image/jpeg" } });
  const confirmed = await publicApi.post(`/field/${token}/photos/confirm`, {
    path,
    isExtra: photo.isExtra,
  });
  return confirmed.id;
}

export async function submitReport(token: string): Promise<void> {
  const progress = await getProgress(token);
  const photos = await getPhotosForToken(token);

  const anchorPoints = progress.anchorPoints.map((point) => ({
    tag: point.tag,
    accessoryId: point.accessoryId,
    installationMode: point.installationMode,
    anchorDepthMm: point.anchorDepthMm,
    distanceBetweenPointsMm: point.distanceBetweenPointsMm,
    testInstrument: point.testInstrument,
    testAppliedLoadKn: point.testAppliedLoadKn,
    testDurationSeconds: point.testDurationSeconds,
    testResult: point.testResult,
    notes: point.notes,
    photoIds: photos.filter((p) => p.anchorTag === point.tag && p.uploaded && p.remotePhotoId).map((p) => p.remotePhotoId!),
  }));

  await publicApi.post(`/field/${token}/submit`, {
    siteAddress: progress.siteAddress,
    siteIdentification: progress.siteIdentification,
    anchorPoints,
  });
}
