import { binaryRequest } from './api';

export async function downloadFile(path: string, filename: string, signal?: AbortSignal): Promise<void> {
  const blob = await binaryRequest(path, signal);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
