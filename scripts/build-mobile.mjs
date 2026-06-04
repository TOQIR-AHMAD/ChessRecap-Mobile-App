// Build the static export consumed by the Capacitor shell, then sync it into the
// native projects if any exist.
//
// The Chess.com / Lichess import routes (app/api) read the incoming request, so
// they can't be part of a static export (`output: 'export'`). We stash them aside
// for the build and always restore them afterwards — even on failure or an
// interrupted earlier run. On-device, those imports run over native HTTP instead;
// see lib/import/client.ts. The export lands in ./out (capacitor.config webDir).
import { rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const apiDir = join(root, "app", "api");
const stash = join(root, ".mobile-stash-api");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// On Windows, freshly-written files can be briefly locked by AV/indexer scans,
// which makes a directory rename fail with EPERM/EBUSY. Retry to ride it out.
async function renameWithRetry(from, to, attempts = 12, delayMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      await rename(from, to);
      return;
    } catch (err) {
      const transient = ["EPERM", "EBUSY", "EACCES", "ENOTEMPTY"].includes(err.code);
      if (!transient || i === attempts - 1) throw err;
      await sleep(delayMs);
    }
  }
}

function runStep(cmd, args, extraEnv = {}) {
  const res = spawnSync(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if (res.status !== 0) {
    throw new Error(`\`${cmd} ${args.join(" ")}\` exited with code ${res.status}`);
  }
}

async function main() {
  // Recover the stash if a previous run was interrupted before restoring it.
  if (existsSync(stash) && !existsSync(apiDir)) {
    await renameWithRetry(stash, apiDir);
  }

  const hadApi = existsSync(apiDir);
  if (hadApi) await renameWithRetry(apiDir, stash);

  try {
    runStep("npx", ["next", "build"], { MOBILE_BUILD: "1" });

    const hasNative =
      existsSync(join(root, "android")) || existsSync(join(root, "ios"));
    if (hasNative) {
      runStep("npx", ["cap", "sync"]);
    } else {
      console.log("\n[build-mobile] Static export ready in ./out");
      console.log("[build-mobile] No native platforms yet — add one with:");
      console.log("[build-mobile]   npm run cap:add:android   (or  npm run cap:add:ios)\n");
    }
  } finally {
    if (hadApi && existsSync(stash)) await renameWithRetry(stash, apiDir);
  }
}

main().catch((err) => {
  console.error(`\n[build-mobile] ${err.message}\n`);
  process.exit(1);
});
