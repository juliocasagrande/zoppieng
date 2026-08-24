import { publicApi } from "../../lib/api.js";
import { getPhotosForToken, getProgress, saveProgress, updatePhoto, type LocalPhoto } from "./db.js";

// Uploads any photos captured while offline (or just not yet uploaded), then
// — if the local submission is marked "draft" but the user tapped submit
// while offline — pushes the final submission. Safe to call repeatedly
// (idempotent): already-uploaded photos and already-submitted reports are
// skipped.
export async function syncToken(token: string): Promise<{ uploaded: number; submitted: boolean; submitError: string | null }> {
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
  let submitError: string | null = null;
  if (progress.status === "submitted") {
    submitted = true;
  } else if (progress.status === "draft" && progress.pendingSubmit) {
    const allUploaded = (await getPhotosForToken(token)).every((p) => p.uploaded);
    if (allUploaded) {
      try {
        await submitReport(token);
        await saveProgress({ ...progress, status: "submitted" });
        submitted = true;
      } catch (err) {
        // Data stays safe locally either way — pendingSubmit remains true, so
        // the next sync (retry button / reconnect) tries again.
        submitError = err instanceof Error ? err.message : "Falha ao enviar o laudo.";
      }
    }
  }

  return { uploaded, submitted, submitError };
}

// Mirrors the labels shown next to each photo slot in FieldWizard.tsx, so the
// caption recorded here (and later printed under the photo in the PDF)
// reflects exactly what the technician was asked to capture in the field.
const PHOTO_KIND_CAPTION: Record<LocalPhoto["kind"], string> = {
  point: "Foto do ponto de ancoragem",
  test: "Foto do teste (manômetro e tempo)",
  extra: "Foto complementar",
};

async function uploadPhoto(token: string, photo: LocalPhoto): Promise<string> {
  const { path, signedUrl } = await publicApi.post(`/field/${token}/photos/upload-url`, { ext: "jpg" });
  await fetch(signedUrl, { method: "PUT", body: photo.blob, headers: { "Content-Type": "image/jpeg" } });
  const confirmed = await publicApi.post(`/field/${token}/photos/confirm`, {
    path,
    isExtra: photo.kind === "extra",
    caption: PHOTO_KIND_CAPTION[photo.kind],
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
    deviceType: point.deviceType,
    anchorDepthMm: point.anchorDepthMm,
    distanceBetweenPointsMm: point.distanceBetweenPointsMm,
    testInstrument: point.testInstrument,
    testReferenceLoadKgf: point.testReferenceLoadKgf,
    testAppliedLoadKgf: point.testAppliedLoadKgf,
    testDurationSeconds: point.testDurationSeconds,
    testLoadDirection: point.testLoadDirection,
    testResult: point.testResult,
    fixationMaterialReference: point.fixationMaterialReference,
    systemType: point.systemType,
    systemPurpose: point.systemPurpose,
    capacityUsers: point.capacityUsers,
    supportStructure: point.supportStructure,
    fixationModeDetail: point.fixationModeDetail,
    environmentCondition: point.environmentCondition,
    notes: point.notes,
    issueTags: point.issueTags,
    photoIds: photos.filter((p) => p.anchorTag === point.tag && p.uploaded && p.remotePhotoId).map((p) => p.remotePhotoId!),
  }));

  await publicApi.post(`/field/${token}/submit`, {
    fieldExecutorName: progress.fieldExecutorName,
    fieldExecutorRole: progress.fieldExecutorRole,
    accompanyingClientName: progress.accompanyingClientName,
    accompanyingClientRole: progress.accompanyingClientRole,
    testEquipmentManufacturer: progress.testEquipmentManufacturer,
    testEquipmentModel: progress.testEquipmentModel,
    testEquipmentSerial: progress.testEquipmentSerial,
    testEquipmentCapacityKgf: progress.testEquipmentCapacityKgf,
    anchorPoints,
  });
}
