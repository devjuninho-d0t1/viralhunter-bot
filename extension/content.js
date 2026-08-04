/**
 * Botão flutuante nas páginas de vídeo.
 *
 * Instagram, TikTok e YouTube são SPAs: a URL muda sem recarregar a página,
 * então o botão precisa reavaliar a cada navegação em vez de decidir só uma
 * vez no load.
 */

(() => {
  const ID = "vh-mine-btn";
  let lastUrl = "";

  const IG_CONTENT = new Set(["reel", "reels", "p", "tv", "share", "stories"]);

  function segments(u) {
    return u.pathname.split("/").filter(Boolean).map((s) => s.toLowerCase());
  }

  /** Só mostra o botão onde existe um vídeo específico para minerar. */
  function isVideoPage(raw) {
    let u;
    try {
      u = new URL(raw);
    } catch {
      return false;
    }
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const seg = segments(u);

    if (host.endsWith("instagram.com")) {
      if (seg.length >= 2 && IG_CONTENT.has(seg[0])) return true;
      return seg.length >= 3 && IG_CONTENT.has(seg[1]);
    }
    if (host.endsWith("tiktok.com")) {
      if (host !== "tiktok.com") return true;
      return seg.length >= 2 && seg[0].startsWith("@");
    }
    if (host.endsWith("youtube.com")) {
      if (seg[0] === "shorts" || seg[0] === "live") return seg.length >= 2;
      return seg[0] === "watch" && !!u.searchParams.get("v");
    }
    return false;
  }

  function icon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 12L3 21"/>
      <path d="M14.5 9.5c3-3 6.5-4 8.5-3.5-1.5-3-6-4-9.5-2S8 10 7 12c2-1 4.5-.5 7.5-2.5z"/>
    </svg>`;
  }

  function setState(btn, state, label) {
    btn.dataset.state = state;
    btn.querySelector(".vh-label").textContent = label;
  }

  function reset(btn) {
    setTimeout(() => {
      if (btn.isConnected) setState(btn, "idle", "Minerar");
    }, 2600);
  }

  function create() {
    const btn = document.createElement("button");
    btn.id = ID;
    btn.type = "button";
    btn.innerHTML = `${icon()}<span class="vh-label">Minerar</span>`;
    btn.addEventListener("click", async (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (btn.dataset.state === "loading") return;
      setState(btn, "loading", "Minerando…");
      try {
        const res = await chrome.runtime.sendMessage({
          type: "vh-mine",
          payload: { url: location.href },
        });
        if (res?.ok) {
          setState(btn, "ok", `Salvo em ${res.result.folder}`);
        } else if (res?.error === "SEM_TOKEN") {
          setState(btn, "err", "Conecte nas opções");
        } else {
          setState(btn, "err", res?.error || "Falhou");
        }
      } catch {
        // service worker hibernou ou a extensão foi recarregada
        setState(btn, "err", "Recarregue a página");
      }
      reset(btn);
    });
    document.body.appendChild(btn);
    return btn;
  }

  function sync() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    const existing = document.getElementById(ID);
    if (isVideoPage(location.href)) {
      if (existing) setState(existing, "idle", "Minerar");
      else create();
    } else if (existing) {
      existing.remove();
    }
  }

  // aviso vindo do atalho de teclado (que não passa pelo botão)
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type !== "vh-flash") return;
    const btn = document.getElementById(ID);
    if (btn) {
      setState(btn, msg.kind === "ok" ? "ok" : "err", msg.text);
      reset(btn);
      return;
    }
    const toast = document.createElement("div");
    toast.className = `vh-toast ${msg.kind}`;
    toast.textContent = msg.text;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  });

  sync();
  // SPA: não há evento confiável de rota, então observa mutação + popstate
  new MutationObserver(sync).observe(document.body, {
    childList: true,
    subtree: true,
  });
  window.addEventListener("popstate", sync);
})();
