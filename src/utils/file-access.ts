// Cross-browser helpers for saving files, preferring the File System Access API when available.

export type FileHandle = any | null;

export async function saveAs(blob: Blob, suggestedName: string, mimeType = 'application/zip'): Promise<{ handle: FileHandle; fileName: string } | null> {
  try {
    const w = window as any;
    if (w.showSaveFilePicker) {
      const handle = await w.showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Gestalt 3D / Export',
            accept: { [mimeType]: [`.${suggestedName.split('.').pop()}`] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { handle, fileName: suggestedName };
    }
  } catch (e) {
    console.warn('File System Access API saveAs failed, falling back to download', e);
  }

  // Fallback download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = suggestedName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return null;
}

export async function saveWithHandle(handle: FileHandle, blob: Blob): Promise<boolean> {
  try {
    if (!handle) return false;
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return true;
  } catch (e) {
    console.warn('Saving with existing handle failed, will fallback to Save As', e);
    return false;
  }
}
