export type DeliverResult = 'shared' | 'downloaded' | 'cancelled';

/** Saves through an object URL and a temporary link. */
function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Gets a file out of the app. With `share` (the default) it opens the system share sheet when
 * the browser can share files, and downloads otherwise. Without it, it always downloads.
 */
export async function deliverFile(
  content: BlobPart,
  name: string,
  type: string,
  { share = true }: { share?: boolean } = {},
): Promise<DeliverResult> {
  const file = new File([content], name, { type });
  if (share && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Sharing failed for another reason: a download still gets the file out.
    }
  }
  download(file);
  return 'downloaded';
}
