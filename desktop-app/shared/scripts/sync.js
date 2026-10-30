// Copies the shared package into a platform folder (./shared-build) so each platform builds on its own.
const fs = require("fs"), path = require("path");
const src = path.resolve(__dirname, ".."), dst = path.resolve(process.cwd(), "shared-build");
fs.rmSync(dst, { recursive: true, force: true });
fs.cpSync(src, dst, { recursive: true, filter: (p) => !p.includes("node_modules") && !p.endsWith(path.sep + "scripts") });
console.log("shared copied to", dst);
