const $ = (id) => document.getElementById(id);

function show(el) {
  el.classList.remove("hidden");
}
function hide(el) {
  el.classList.add("hidden");
}

function setStatus(kind, text) {
  const s = $("status");
  s.textContent = text;
  s.className = `status ${kind}`;
}

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function init() {
  $("opts").addEventListener("click", () => chrome.runtime.openOptionsPage());
  $("toOptions").addEventListener("click", () =>
    chrome.runtime.openOptionsPage(),
  );

  const tab = await currentTab();
  $("url").value = tab?.url ?? "";

  const folders = await chrome.runtime.sendMessage({ type: "vh-folders" });

  if (!folders?.ok) {
    if (folders?.error === "SEM_TOKEN") {
      show($("setup"));
      return;
    }
    show($("form"));
    setStatus("err", folders?.error || "Não foi possível falar com o painel");
    return;
  }

  const { defaultFolderId } = await chrome.storage.sync.get({
    defaultFolderId: null,
  });
  const sel = $("folder");
  for (const f of folders.folders) {
    const opt = document.createElement("option");
    opt.value = f.id;
    opt.textContent = f.name;
    if (String(f.id) === String(defaultFolderId)) opt.selected = true;
    sel.appendChild(opt);
  }

  show($("form"));

  $("form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("submit");
    btn.disabled = true;
    setStatus("", "Minerando…");
    const res = await chrome.runtime.sendMessage({
      type: "vh-mine",
      payload: {
        url: $("url").value,
        folderId: Number(sel.value) || undefined,
        note: $("note").value.trim() || undefined,
      },
    });
    if (res?.ok) {
      setStatus("ok", `Salvo em ${res.result.folder} (#${res.result.id})`);
      $("note").value = "";
      setTimeout(() => window.close(), 1200);
    } else {
      setStatus("err", res?.error || "Não foi possível minerar");
      btn.disabled = false;
    }
  });
}

init();
