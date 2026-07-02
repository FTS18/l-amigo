/**
 * sendMessageWithRetry — popup → background RPC using long-lived ports with ready-handshake.
 *
 * Protocol:
 * 1. Popup opens port 'popup-rpc' → Chrome wakes the sleeping SW
 * 2. Background's onConnect fires (after SW is fully booted) → sends { type:'ready' }
 * 3. Popup receives 'ready' → sends the actual message
 * 4. Background processes → sends response
 * 5. Popup resolves with response, disconnects port
 *
 * If port disconnects before ready/response → retry with backoff.
 */
export function sendMessageWithRetry(message: any, maxRetries = 5): Promise<any> {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    function attempt() {
      attempts++;
      let responded = false;
      let messageSent = false;

      try {
        const port = chrome.runtime.connect({ name: 'popup-rpc' });

        port.onMessage.addListener((msg) => {
          if (msg?.type === 'ready' && !messageSent) {
            // Background is alive and ready — send the actual request
            messageSent = true;
            try { port.postMessage(message); } catch {}
            return;
          }
          // Actual response received
          responded = true;
          try { port.disconnect(); } catch {}
          resolve(msg);
        });

        port.onDisconnect.addListener(() => {
          // Suppress "Unchecked runtime.lastError"
          void chrome.runtime.lastError;
          if (!responded) {
            if (attempts < maxRetries) {
              console.warn(`[Popup] Service worker not ready, retrying (${attempts}/${maxRetries})…`);
              setTimeout(attempt, 500 + attempts * 400);
            } else {
              reject(new Error('Could not establish connection. Receiving end does not exist.'));
            }
          }
        });

        // Safety timeout: if no 'ready' in 4s, try sending anyway (old background without handshake)
        setTimeout(() => {
          if (!responded && !messageSent) {
            messageSent = true;
            try { port.postMessage(message); } catch {}
          }
        }, 4000);

      } catch (err: any) {
        if (attempts < maxRetries) {
          console.warn(`[Popup] Service worker not ready, retrying (${attempts}/${maxRetries})…`);
          setTimeout(attempt, 500 + attempts * 400);
        } else {
          reject(err);
        }
      }
    }

    attempt();
  });
}

