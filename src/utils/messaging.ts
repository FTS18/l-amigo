/**
 * sendMessageWithRetry — shared utility for popup → background messaging.
 * MV3 service workers can go idle; this wakes them before sending.
 */
export function sendMessageWithRetry(message: any, maxRetries = 3): Promise<any> {
  return new Promise(async (resolve, reject) => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const resp = await new Promise<any>((res, rej) => {
          chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
              rej(new Error(chrome.runtime.lastError.message));
            } else {
              res(response);
            }
          });
        });
        return resolve(resp);
      } catch (err: any) {
        const isConnectionError =
          err.message?.includes('Receiving end does not exist') ||
          err.message?.includes('Could not establish connection');

        if (isConnectionError && attempt < maxRetries - 1) {
          console.warn(
            `[Popup] Service worker not ready, retrying (${attempt + 1}/${maxRetries})…`,
          );
          await new Promise<void>((r) => setTimeout(r, 500));
          continue;
        }
        return reject(err);
      }
    }
    reject(new Error('Failed to connect to background service worker'));
  });
}
