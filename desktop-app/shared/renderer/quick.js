// Quick chat: talks to the same /api/chat SSE endpoint as the web app, through the desktop session in the main process.
const $ = (id) => document.getElementById(id);
let history = [];
const id = () => Math.random().toString(36).slice(2, 12);
async function loadAgents() {
  const r = await window.lexari.api("/agents");
  if (r.status === 401) return ($("status").textContent = "Sign in to chat");
  if (!r.status) return ($("status").textContent = "Offline");
  $("status").textContent = "";
  const sel = $("agent"); sel.length = 1;
  ((r.json && r.json.agents) || []).forEach((a) => { const o = document.createElement("option"); o.value = a.slug; o.textContent = (a.meta && a.meta.nick) || a.name; sel.appendChild(o); });
}
loadAgents(); window.addEventListener("focus", loadAgents);
function bubble(cls, text) { $("empty")?.remove(); const d = document.createElement("div"); d.className = "m " + cls; d.textContent = text; $("log").appendChild(d); $("log").scrollTop = 1e9; return d; }
$("full").onclick = () => window.lexari.openMain("/agents");
$("form").onsubmit = (e) => {
  e.preventDefault(); const text = $("msg").value.trim(); if (!text) return; $("msg").value = "";
  const speaker = $("agent").value; bubble("you", text); const out = bubble("ai typing", ""); let full = "";
  window.lexari.chat({ convo: speaker, speaker, text, history: history.slice(-16), userMsgId: id(), replyMsgId: id() }, (ev) => {
    if (ev.token) full += ev.token; if (typeof ev.replace === "string") full = ev.replace;
    if (ev.error) full = ev.error;
    out.textContent = full; $("log").scrollTop = 1e9;
    if (ev.end) { out.classList.remove("typing"); if (!ev.error) history.push({ from: "you", text }, { from: speaker, text: full.slice(0, 2000) }); }
  });
};
