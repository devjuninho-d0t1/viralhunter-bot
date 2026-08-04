const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  baseUrl: "https://b2b-minerador.vercel.app",
  token: "",
  minerName: "",
  defaultFolderId: null,
};

function status(el, kind, text) {
  el.textContent = text;
  el.className = `status ${kind}`;
}

async function loadFolders(selectedId) {
  const res = await chrome.runtime.sendMessage({ type: "vh-folders" });
  const sel = $("defaultFolder");
  sel.innerHTML = "";
  if (!res?.ok) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "conecte para carregar as pastas";
    sel.appendChild(opt);
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  for (const f of res.folders) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    if (String(f.id) === String(selectedId)) opt.selected = true;
    sel.appendChild(opt);
  }
}

async function init() {
  const cfg = { ...DEFAULTS, ...(await chrome.storage.sync.get(DEFAULTS)) };
  $("baseUrl").value = cfg.baseUrl;
  $("minerName").value = cfg.minerName;
  if (cfg.token) status($("connStatus"), "ok", "Conectado ao painel.");
  await loadFolders(cfg.defaultFolderId);

  $("connect").addEventListener("click", async () => {
    const baseUrl = $("baseUrl").value.trim();
    const password = $("password").value;
    if (!baseUrl || !password) {
      status($("connStatus"), "err", "Preencha endereço e senha.");
      return;
    }
    $("connect").disabled = true;
    status($("connStatus"), "", "Conectando…");
    const res = await chrome.runtime.sendMessage({
      type: "vh-connect",
      baseUrl,
      password,
    });
    $("connect").disabled = false;
    if (res?.ok) {
      $("password").value = "";
      status($("connStatus"), "ok", "Conectado ao painel.");
      await loadFolders(cfg.defaultFolderId);
    } else {
      status($("connStatus"), "err", res?.error || "Não foi possível conectar");
    }
  });

  $("save").addEventListener("click", async () => {
    const folderValue = $("defaultFolder").value;
    await chrome.storage.sync.set({
      minerName: $("minerName").value.trim(),
      defaultFolderId: folderValue ? Number(folderValue) : null,
    });
    status($("saveStatus"), "ok", "Preferências salvas.");
    setTimeout(() => status($("saveStatus"), "", ""), 2500);
  });
}

init();
