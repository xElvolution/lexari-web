(async () => {
  const c = await window.lexari.config();
  document.getElementById("ver").textContent = c.version;
  document.getElementById("net").textContent = c.network.label;
  document.getElementById("plat").textContent = { darwin: "macOS", win32: "Windows", linux: "Linux" }[c.platform] || c.platform;
})();
document.getElementById("close").onclick = () => window.close();
document.getElementById("site").onclick = () => window.lexari.external("https://lexari.ai");
document.getElementById("docs").onclick = () => window.lexari.external("https://docs.lexari.ai");
document.addEventListener("keydown", (e) => { if (e.key === "Escape") window.close(); });
