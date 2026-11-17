import type { Page } from '@playwright/test';

/** Writes check-ins and max tests straight into the database (the app reads them live). */
export async function seedRecords(
  page: Page,
  records: { checkIns?: object[]; maxTests?: object[] },
): Promise<void> {
  await page.evaluate(async (data) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('easy-workout');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const tx = db.transaction(['checkIns', 'maxTests'], 'readwrite');
    for (const c of data.checkIns ?? []) tx.objectStore('checkIns').put(c);
    for (const m of data.maxTests ?? []) tx.objectStore('maxTests').put(m);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, records);
}
