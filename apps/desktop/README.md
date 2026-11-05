# CraneGo Desktop

Electron shell for office staff and dispatchers (Windows / macOS / Linux). It loads the
CraneGo web app from your server, so desktop users always get the latest release without
reinstalling.

```bash
cd apps/desktop
npm install
npm start            # run in development
npm run dist:win     # build Windows installer (out/)
npm run dist:mac     # build macOS dmg (run on a Mac)
npm run dist:linux   # build AppImage + .deb
```

On first launch it asks for the server address (`https://…`; plain `http://` is only allowed
for `localhost`). Change it later from **CraneGo → Server settings…**. You can also preset it
with the `CRANEGO_SERVER_URL` environment variable.

Security: context isolation, sandboxed renderer, no Node integration, navigation restricted
to the configured server, external links open in the system browser, and only geolocation
permission is granted (for the configured server).
