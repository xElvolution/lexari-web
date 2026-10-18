const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("lexari", {
  api: (p) => ipcRenderer.invoke("lexari:api", p),
  chat: (body, onEv) => { const id = Math.random().toString(36).slice(2); const h = (_e, rid, ev) => { if (rid !== id) return; onEv(ev); if (ev.end) ipcRenderer.removeListener("lexari:chat-ev", h); }; ipcRenderer.on("lexari:chat-ev", h); ipcRenderer.send("lexari:chat", id, body); },
  config: () => ipcRenderer.invoke("lexari:config"),
  win: (a) => ipcRenderer.send("lexari:win", a),
  external: (u) => ipcRenderer.send("lexari:external", u),
  openMain: (r) => ipcRenderer.send("lexari:open-main", r),
  signInBrowser: () => ipcRenderer.send("lexari:signin-browser"),
  setNetwork: (n) => ipcRenderer.invoke("lexari:set-network", n),
  onNavigate: (f) => ipcRenderer.on("lexari:navigate", (_e, u) => f(u)),
  onMax: (f) => ipcRenderer.on("lexari:max", (_e, m) => f(m)),
});
