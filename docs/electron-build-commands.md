# Electron Build Commands

Run these commands from a fresh clone to recreate the local environment and
build the Windows portable Electron executable.

## 1. Clone

```powershell
git clone <REPOSITORY_URL> pylotto
cd pylotto
```

Replace `<REPOSITORY_URL>` with the GitHub repository URL.

## 2. Verify Required Files

```powershell
Test-Path .\data\lotto_results.yaml
Test-Path .\web\package-lock.json
Test-Path .\web\electron\main.cjs
```

Each command should print:

```text
True
```

## 3. Verify Node and npm

```powershell
node --version
npm --version
```

Use Node `22.12.0` or newer. A known-good local build used:

```text
node v24.16.0
npm 11.13.0
```

## 4. Install Web Dependencies

```powershell
cd web
npm ci
```

Use `npm ci` for clean clones because it installs exactly from
`package-lock.json`.

## 5. Test the Web Build

```powershell
npm run build
```

Expected result: TypeScript checks pass and Vite creates `web/dist`.

## 6. Build the Portable Electron Executable

```powershell
npm run electron:build
```

This runs:

```text
npm run build:electron
electron-builder --win portable
node electron/copy-portable-data.cjs
```

The output executable should be:

```text
web/electron-package/PyLotto 0.1.0.exe
```

The unpacked app folder should be:

```text
web/electron-package/win-unpacked
```

## 7. Run the Built App

Open:

```text
web/electron-package/PyLotto 0.1.0.exe
```

## Development Mode

To run the Vite dev server:

```powershell
cd web
npm run dev
```

To run Electron after building the Electron renderer:

```powershell
cd web
npm run electron
```

## Troubleshooting

### `npm ci` fails with Node engine errors

Install Node `22.12.0+`, then delete `web/node_modules` and run again:

```powershell
cd web
npm ci
```

### Electron download fails

Check internet access, proxy, VPN, or firewall rules. Electron is downloaded
during dependency/build steps if it is not already cached.

### Output file is locked

If the build says the output file is locked, wait. Electron-builder often
continues once antivirus scanning releases the file.

If it stays locked, close any running PyLotto executable and try again:

```powershell
npm run electron:build
```

### Missing lotto data in the built app

Confirm this file exists before building:

```powershell
Test-Path ..\data\lotto_results.yaml
```

from inside the `web` directory. The build copies that file to:

```text
web/electron-package/data/lotto_results.yaml
```

