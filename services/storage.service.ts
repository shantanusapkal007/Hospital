// Uses Google Drive API via /api/upload route for image storage
import imageCompression from "browser-image-compression";

const MB = 1024 * 1024;
const PATIENT_PHOTO_MAX_DIMENSION = 720;
const VISIT_IMAGE_MAX_DIMENSION = 1280;

type UploadProgressCallback = (progress: number) => void;

function sanitizeFileName(fileName: string) {
  return fileName.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}

function createUniqueId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function optimizeImageForUpload(file: File, folder: string) {
  if (typeof window === "undefined") return file;
  if (!file.type.startsWith("image/")) return file;
  if (file.type === "image/svg+xml" || file.type === "image/gif") return file;

  const isPatientPhoto = folder.includes("patient-photos");
  const options = {
    maxSizeMB: isPatientPhoto ? 0.2 : 0.5,
    maxWidthOrHeight: isPatientPhoto ? PATIENT_PHOTO_MAX_DIMENSION : VISIT_IMAGE_MAX_DIMENSION,
    useWebWorker: true,
    fileType: "image/webp",
    initialQuality: 0.65,
  };

  try {
    const compressedBlob = await imageCompression(file, options);
    const newName = `${createUniqueId()}-${sanitizeFileName(file.name.replace(/\.[^./\\]+$/, "") + ".webp")}`;
    return new File([compressedBlob], newName, {
      type: "image/webp",
      lastModified: file.lastModified,
    });
  } catch (error) {
    console.error("Compression error:", error);
    return file;
  }
}

export function validateImageFiles(files: File[], maxSizeMb: number) {
  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      throw new Error("Only image files are allowed.");
    }

    if (file.size > maxSizeMb * MB) {
      throw new Error(`Each image must be ${maxSizeMb}MB or smaller.`);
    }
  }
}

export async function uploadFileToStorage(file: File, folder: string, onProgress?: UploadProgressCallback) {
  const optimizedFile = await optimizeImageForUpload(file, folder);
  const formData = new FormData();
  formData.append("file", optimizedFile);

  // Fake upload progress initialization since fetch doesn't natively support it easily
  onProgress?.(10);

  const res = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  onProgress?.(100);

  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Failed to upload to Google Drive");
  }

  const data = await res.json();
  return data.url;
}

export async function uploadFilesToStorage(files: File[], folder: string, onProgress?: UploadProgressCallback) {
  if (files.length === 0) {
    onProgress?.(100);
    return [];
  }

  const results = new Array<string>(files.length);
  const fileProgress = new Array<number>(files.length).fill(0);

  const updateOverallProgress = () => {
    const progressTotal = fileProgress.reduce((sum, value) => sum + value, 0);
    onProgress?.(Math.round(progressTotal / files.length));
  };

  await Promise.all(
    files.map(async (file, i) => {
      results[i] = await uploadFileToStorage(file, folder, (progress) => {
        fileProgress[i] = progress;
        updateOverallProgress();
      });
      fileProgress[i] = 100;
      updateOverallProgress();
    })
  );

  onProgress?.(100);
  return results;
}
