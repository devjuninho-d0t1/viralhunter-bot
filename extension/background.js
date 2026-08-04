/**
 * Service worker: é ele que fala com o painel.
 *
 * Toda chamada de rede sai daqui de propósito — o service worker herda as
 * host_permissions do manifest, então não esbarra em CORS nem depende de a
 * pessoa estar logada no painel naquela aba.
 */

const DEFAULTS = {
  baseUrl: "https://b2b-minerador.vercel.app",
  token: "",
  minerName: "",
  defaultFolderId: null,
};

async function config() {
  const stored = await chrome.storage.sync.get(DEFAULTS);
  return { ...DEFAULTS, ...stored };
}

function apiUrl(base, path) {
  return `${String(base).replace(/\/+$/, "")}${path}`;
}

/** Troca a senha do time pelo token e guarda só o token. */
async function connect(baseUrl, password) {
  const res = await fetch(apiUrl(baseUrl, "/api/extension/auth"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.token) {
    throw new Error(json.error || "Não foi possível conectar");
  }
  await chrome.storage.sync.set({
    baseUrl: String(baseUrl).replace(/\/+$/, ""),
    token: json.token,
  });
  return true;
}

async function authedFetch(path, init = {}) {
  const { baseUrl, token } = await config();
  if (!token) throw new Error("SEM_TOKEN");
  const res = await fetch(apiUrl(baseUrl, path), {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  if (res.status === 401) throw new Error("SEM_TOKEN");
  return res;
}

async function listFolders() {
  const res = await authedFetch("/api/extension/folders");
  const json = await res.json().catch(() => ({}));
  if (!json.ok) throw new Error(json.error || "Erro ao carregar pastas");
  return json.folders;
}

async function mine({ url, folderId, note }) {
  const { minerName, defaultFolderId } = await config();
  const res = await authedFetch("/api/platform/links", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      folderId: folderId ?? defaultFolderId ?? undefined,
      note: note || undefined,
      source: minerName || "extensão",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 409 (repetido) e 422 (perfil) não são falha de sistema: a mensagem do
    // servidor já explica o que houve
    const err = new Error(json.error || "Não foi possível minerar");
    err.status = res.status;
    throw err;
  }
  return json;
}

/** Aviso rápido dentro da página; se não der, cai pra notificação nenhuma. */
async function flash(tabId, kind, text) {
  if (tabId == null) return;
  try {
    await chrome.tabs.sendMessage(tabId, { type: "vh-flash", kind, text });
  } catch {
    /* aba sem content script (ex.: chrome://) — silencioso de propósito */
  }
}

async function mineTab(tab) {
  if (!tab?.url) return;
  try {
    const r = await mine({ url: tab.url });
    await flash(tab.id, "ok", `Minerado em ${r.folder}`);
  } catch (e) {
    const msg = e.message === "SEM_TOKEN" ? "Conecte a extensão nas opções" : e.message;
    await flash(tab.id, "err", msg);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      switch (msg?.type) {
        case "vh-connect":
          await connect(msg.baseUrl, msg.password);
          sendResponse({ ok: true });
          break;
        case "vh-folders":
          sendResponse({ ok: true, folders: await listFolders() });
          break;
        case "vh-mine":
          sendResponse({ ok: true, result: await mine(msg.payload) });
          break;
        case "vh-mine-tab":
          await mineTab(sender.tab ?? msg.tab);
          sendResponse({ ok: true });
          break;
        default:
          sendResponse({ ok: false, error: "comando desconhecido" });
      }
    } catch (e) {
      sendResponse({ ok: false, error: e.message, status: e.status });
    }
  })();
  return true; // resposta assíncrona
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "minerar") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  await mineTab(tab);
});
