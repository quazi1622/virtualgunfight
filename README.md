# Virtual Gunfight

A no-build static WebXR prototype where a player throws a stone at a target and scores points based on the hit zone.

## Run Locally

From PowerShell:

```powershell
.\run-dev-server.ps1
```

Open:

```text
http://localhost:8080
```

The server also prints LAN URLs for testing from another device on the same network.

## Deploy

This app is plain static HTML, CSS, and JavaScript. It can be deployed to Vercel with:

- Framework preset: Other
- Build command: empty
- Output directory: `.`
- Install command: empty

WebXR headset testing should use the HTTPS Vercel URL.
