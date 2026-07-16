"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface FolderItem {
  id: number;
  name: string;
  count: number;
}

interface LinkItem {
  id: number;
  url: string;
  folder_id: number;
  folder: string;
  added_by: string | null;
  created_at: string;
}

interface Toast {
  id: number;
  kind: "ok" | "err";
  text: string;
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "agora";
  if (s < 3600) return `há ${Math.floor(s / 60)}min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)}h`;
  return `há ${Math.floor(s / 86400)}d`;
}

export default function Painel() {
  const router = useRouter();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [selected, setSelected] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastSeq = useRef(0);

  const toast = useCallback((kind: Toast["kind"], text: string) => {
    const id = ++toastSeq.current;
    setToasts((t) => [...t, { id, kind, text }]);
    setTimeout(
      () => setToasts((t) => t.filter((x) => x.id !== id)),
      3500,
    );
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/platform/data", {
        cache: "no-store",
      });
      if (res.status === 401) {
        router.push("/");
        return;
      }
      const json = await res.json();
      if (json.ok) {
        setFolders(json.folders);
        setLinks(json.links);
        setLoaded(true);
      }
    } catch {
      /* rede oscilou — próximo poll resolve */
    }
  }, [router]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  async function act(
    input: RequestInfo,
    init: RequestInit,
    okMsg: string,
  ) {
    try {
      const res = await fetch(input, init);
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        toast("ok", okMsg);
        await load();
      } else {
        toast("err", json.error ?? "algo deu errado");
      }
    } catch {
      toast("err", "erro de conexão");
    }
  }

  function createFolder(e: React.FormEvent) {
    e.preventDefault();
    const name = newFolder.trim();
    if (!name) return;
    setNewFolder("");
    act(
      "/api/platform/folders",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      },
      `pasta "${name.toLowerCase()}" criada`,
    );
  }

  function renameFolder(f: FolderItem) {
    const name = window.prompt(`Renomear "${f.name}" para:`, f.name);
    if (!name || name.trim() === f.name) return;
    act(
      "/api/platform/folders",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: f.id, name: name.trim() }),
      },
      `renomeada para "${name.trim().toLowerCase()}"`,
    );
  }

  function deleteFolder(f: FolderItem) {
    if (
      !window.confirm(
        `Apagar a pasta "${f.name}" e os ${f.count} link(s) dela? Não tem desfazer.`,
      )
    )
      return;
    if (selected === f.id) setSelected("all");
    act(
      `/api/platform/folders?id=${f.id}`,
      { method: "DELETE" },
      `pasta "${f.name}" apagada`,
    );
  }

  function deleteLinkAction(l: LinkItem) {
    if (!window.confirm("Apagar este link? Não tem desfazer.")) return;
    act(
      `/api/platform/links?id=${l.id}`,
      { method: "DELETE" },
      "link apagado",
    );
  }

  function moveLinkAction(l: LinkItem, folderId: number) {
    if (folderId === l.folder_id) return;
    act(
      "/api/platform/links",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: l.id, folderId }),
      },
      "link movido",
    );
  }

  async function logout() {
    await fetch("/api/platform/login", { method: "DELETE" });
    router.push("/");
  }

  const visible = useMemo(() => {
    let list = links;
    if (selected !== "all")
      list = list.filter((l) => l.folder_id === selected);
    const q = search.trim().toLowerCase();
    if (q)
      list = list.filter(
        (l) =>
          l.url.toLowerCase().includes(q) ||
          (l.added_by ?? "").toLowerCase().includes(q) ||
          l.folder.toLowerCase().includes(q),
      );
    return list;
  }, [links, selected, search]);

  const today = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return links.filter((l) => new Date(l.created_at) >= start).length;
  }, [links]);

  const selectedName =
    selected === "all"
      ? "TODOS OS LINKS"
      : folders.find((f) => f.id === selected)?.name.toUpperCase() ?? "";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="pixel brand cursor-blink">VIRALHUNTER</div>
        <div className="topbar-right">
          <span>
            <span className="dot-live" /> ao vivo
          </span>
          <button className="btn btn-ghost" onClick={logout}>
            sair →
          </button>
        </div>
      </header>

      {!loaded ? (
        <div className="loading">carregando o garimpo…</div>
      ) : (
        <>
          <section className="stats">
            <div className="card stat">
              <div className="stat-num">{links.length}</div>
              <div className="stat-label">links minerados</div>
            </div>
            <div className="card stat">
              <div className="stat-num">{folders.length}</div>
              <div className="stat-label">pastas</div>
            </div>
            <div className="card stat">
              <div className="stat-num">{today}</div>
              <div className="stat-label">garimpados hoje</div>
            </div>
          </section>

          <div className="grid">
            <aside className="card rail">
              <div className="rail-title">PASTAS</div>
              <button
                className={`folder-item ${selected === "all" ? "active" : ""}`}
                onClick={() => setSelected("all")}
              >
                <span className="folder-name">▣ todas</span>
                <span className="folder-count">{links.length}</span>
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  className={`folder-item ${selected === f.id ? "active" : ""}`}
                  onClick={() => setSelected(f.id)}
                >
                  <span className="folder-name">▸ {f.name}</span>
                  <span className="folder-actions">
                    {f.name !== "inbox" && (
                      <>
                        <span
                          role="button"
                          className="icon-btn"
                          title="renomear"
                          onClick={(e) => {
                            e.stopPropagation();
                            renameFolder(f);
                          }}
                        >
                          ✎
                        </span>
                        <span
                          role="button"
                          className="icon-btn danger"
                          title="apagar"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteFolder(f);
                          }}
                        >
                          ✕
                        </span>
                      </>
                    )}
                  </span>
                  <span className="folder-count">{f.count}</span>
                </button>
              ))}
              <form className="rail-new" onSubmit={createFolder}>
                <input
                  className="input"
                  placeholder="nova pasta_"
                  value={newFolder}
                  onChange={(e) => setNewFolder(e.target.value)}
                  maxLength={30}
                />
                <button
                  className="btn btn-volt"
                  type="submit"
                  disabled={!newFolder.trim()}
                >
                  +
                </button>
              </form>
            </aside>

            <main className="card board">
              <div className="board-head">
                <span className="board-title">{selectedName}</span>
                <span className="board-count">
                  {visible.length} link(s)
                </span>
                <input
                  className="input board-search"
                  placeholder="buscar_"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              {visible.length === 0 ? (
                <div className="empty">
                  <div className="pixel">NADA POR AQUI AINDA</div>
                  <p>
                    manda um link no grupo do bot
                    <br />
                    ou com <code>#pasta</code> pra cair direto no lugar
                    certo_
                  </p>
                </div>
              ) : (
                visible.map((l) => (
                  <div className="link-row" key={l.id}>
                    <div className="link-main">
                      <a
                        className="link-url"
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {l.url}
                      </a>
                      <div className="link-meta">
                        <span className="link-folder-tag">
                          #{l.folder}
                        </span>
                        {l.added_by && <span>@{l.added_by}</span>}
                        <span>{timeAgo(l.created_at)}</span>
                      </div>
                    </div>
                    <div className="link-actions">
                      <select
                        className="select"
                        value={l.folder_id}
                        onChange={(e) =>
                          moveLinkAction(l, Number(e.target.value))
                        }
                        title="mover pra outra pasta"
                      >
                        {folders.map((f) => (
                          <option key={f.id} value={f.id}>
                            → {f.name}
                          </option>
                        ))}
                      </select>
                      <button
                        className="icon-btn danger"
                        title="apagar link"
                        onClick={() => deleteLinkAction(l)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}
            </main>
          </div>
        </>
      )}

      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind}`}>
            {t.kind === "ok" ? "✓ " : "✕ "}
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
}
