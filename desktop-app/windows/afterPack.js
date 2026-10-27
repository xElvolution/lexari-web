// Sets Lexari.exe's icon and version info with resedit (pure JS), so Windows builds on Linux/macOS need no Wine.
const fs = require("fs"), path = require("path");
exports.default = async function (ctx) {
  if (ctx.electronPlatformName !== "win32") return;
  const ResEdit = await import("resedit");
  const PE = await import("pe-library");
  const R = ResEdit.default || ResEdit, P = PE.default || PE;
  const app = ctx.packager.appInfo;
  const exe = path.join(ctx.appOutDir, `${app.productFilename}.exe`);
  const bin = P.NtExecutable.from(fs.readFileSync(exe), { ignoreCert: true });
  const res = P.NtExecutableResource.from(bin);
  const ico = R.Data.IconFile.from(fs.readFileSync(path.join(__dirname, "shared-build/assets/icon.ico")));
  const groups = R.Resource.IconGroupEntry.fromEntries(res.entries);
  const id = groups.length ? groups[0].id : 1, lang = groups.length ? groups[0].lang : 1033;
  R.Resource.IconGroupEntry.replaceIconsForResource(res.entries, id, lang, ico.icons.map((i) => i.data));
  const vi = R.Resource.VersionInfo.fromEntries(res.entries)[0] || R.Resource.VersionInfo.createEmpty();
  const [a, b, c] = app.version.split(".").map(Number);
  vi.setFileVersion(a, b, c, 0, 1033); vi.setProductVersion(a, b, c, 0, 1033);
  vi.setStringValues({ lang: 1033, codepage: 1200 }, { FileDescription: "Lexari", ProductName: "Lexari", CompanyName: "Lexari", LegalCopyright: `Copyright © ${new Date().getFullYear()} Lexari`, InternalName: "Lexari", OriginalFilename: "Lexari.exe", FileVersion: app.version, ProductVersion: app.version });
  vi.outputToResourceEntries(res.entries);
  res.outputResource(bin);
  fs.writeFileSync(exe, Buffer.from(bin.generate()));
  console.log("  • resedit set icon and version on", path.basename(exe));
};
