# Electron Build Dependencies

This document lists the tools needed to clone PyLotto and build the Windows
portable Electron executable locally.

## Required

- Windows 10 or Windows 11, 64-bit
- Git
- Node.js `22.12.0` or newer
- npm, included with Node.js
- Internet access for the first dependency install and Electron download

Recommended known-good versions:

```powershell
node --version
# v24.16.0

npm --version
# 11.13.0
```

Node `20.19.0` or newer may also work, but Node `22.12.0+` is recommended
because the locked Electron build toolchain includes packages that require
modern Node versions.

## Project Files Required

The clone must include:

- `web/package.json`
- `web/package-lock.json`
- `data/lotto_results.yaml`
- `web/electron/icon.ico`
- `web/electron/main.cjs`
- `web/electron/preload.cjs`
- `web/electron/copy-portable-data.cjs`

The executable build copies `data/lotto_results.yaml` into:

```text
web/electron-package/data/lotto_results.yaml
```

If that YAML file is missing, the app may build but will not have the bundled
lotto history data expected by the desktop shell.

## Optional Python Dependencies

Python is not required for the normal Electron build.

Python is only needed if someone wants to run backend scripts or regenerate data
assets. For that workflow use:

- Python `3.12+`
- `uv`

Python dependencies are declared in:

```text
pyproject.toml
uv.lock
```

## Common Build Blockers

- Old Node version: upgrade to Node `22.12.0+`.
- Running commands from the repository root instead of `web`.
- Missing `data/lotto_results.yaml`.
- Antivirus or Windows Defender temporarily locking `web/electron-package/PyLotto 0.1.0.exe`.
- Corporate proxy/firewall blocking Electron downloads during `npm run electron:build`.
- Installing with `npm install` after package versions drifted. Prefer `npm ci` for a clean clone.

