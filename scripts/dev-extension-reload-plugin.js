const { WebSocketServer } = require('ws');

class DevExtensionReloadPlugin {
  constructor(options = {}) {
    this.port = options.port || 9091;
    this.wss = null;
    this.hasBuiltOnce = false;
  }

  apply(compiler) {
    compiler.hooks.watchRun.tap('DevExtensionReloadPlugin', () => {
      if (!this.wss) {
        this.wss = new WebSocketServer({ port: this.port });
        console.log(`[dev-reload] listening on ws://localhost:${this.port}`);
      }
    });

    compiler.hooks.done.tap('DevExtensionReloadPlugin', (stats) => {
      if (!this.wss || stats.hasErrors()) {
        return;
      }

      // Skip the initial build to avoid a reload loop at startup.
      if (!this.hasBuiltOnce) {
        this.hasBuiltOnce = true;
        return;
      }

      const payload = JSON.stringify({ type: 'reload' });
      for (const client of this.wss.clients) {
        if (client.readyState === 1) {
          client.send(payload);
        }
      }
    });

    compiler.hooks.shutdown.tap('DevExtensionReloadPlugin', () => {
      if (this.wss) {
        this.wss.close();
        this.wss = null;
      }
    });
  }
}

module.exports = DevExtensionReloadPlugin;