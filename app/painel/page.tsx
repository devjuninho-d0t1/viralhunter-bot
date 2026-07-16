"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

function platformOf(url: string): { cls: string; label: string } {
  const u = url.toLowerCase();
  if (u.includes("instagram.com")) return { cls: "ig", label: "IG" };
  if (u.includes("tiktok.com")) return { cls: "tt", label: "TT" };
  if (u.includes("youtu")) return { cls: "yt", label: "YT" };
  if (u.includes("kwai")) return { cls: "tt", label: "KW" };
  if (u.includes("x.com") || u.includes("twitter.com"))
    return { cls: "web", label: "X" };
  return { cls: "web", label: "WEB" };
}

function shortUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, "");
}

/** contador que anima até o valor quando ele muda */
function useCountUp(target: number, ms = 600): number {
  const [value, setValue] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (prev.current === target) return;
    const from = prev.current;
    prev.current = target;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setValue(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      const eased = 1 - Math.pow(1 - p, 4);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const fmt = () =>
      new Date().toLocaleTimeString("pt-BR", { hour12: false });
    setNow(fmt());
    const t = setInterval(() => setNow(fmt()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="cmdbar-clock">{now}</span>;
}

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export default function Painel() {
  const router = useRouter();
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [selected, setSelected] = useState<number | "all">("all");
  const [search, setSearch] = useState("");
  const [newFolder, setNewFolder] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const toastSeq = useRef(0);
  const knownIds = useRef<Set<number> | null>(null);

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
      if (!json.ok) return;
      setFolders(json.folders);
      setLinks(json.links);
      setLoaded(true);
      // marca links que acabaram de chegar (estado "fresh")
      const incoming = new Set<number>(
        (json.links as LinkItem[]).map((l) => l.id),
      );
      if (knownIds.current) {
        const news = [...incoming].filter(
          (id) => !knownIds.current!.has(id),
        );
        if (news.length > 0) {
          setFreshIds(new Set(news));
          setTimeout(() => setFreshIds(new Set()), 2600);
        }
      }
      knownIds.current = incoming;
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

  /* ── derivados ── */

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

  const todayCount = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return links.filter((l) => new Date(l.created_at) >= start).length;
  }, [links]);

  const week = useMemo(() => {
    const days: { label: string; count: number; today: boolean }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      days.push({
        label: DAY_LABELS[d.getDay()],
        count: links.filter((l) => {
          const t = new Date(l.created_at);
          return t >= d && t < next;
        }).length,
        today: i === 0,
      });
    }
    return days;
  }, [links]);

  const weekMax = Math.max(1, ...week.map((d) => d.count));

  const ranking = useMemo(() => {
    const byMiner = new Map<string, number>();
    for (const l of links) {
      const who = l.added_by || "anônimo";
      byMiner.set(who, (byMiner.get(who) ?? 0) + 1);
    }
    return [...byMiner.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [links]);

  const rankMax = Math.max(1, ...ranking.map(([, n]) => n));

  const latest = useMemo(() => links.slice(0, 10), [links]);

  const total = useCountUp(links.length);
  const today = useCountUp(todayCount);

  const selectedName =
    selected === "all"
      ? "TODOS OS LINKS"
      : (folders.find((f) => f.id === selected)?.name ?? "").toUpperCase();

  return (
    <div className="ops">
      <header className="cmdbar">
        <span className="pixel cmdbar-brand cursor-blink">
          VIRALHUNTER
        </span>
        <span className="cmdbar-sep">/</span>
        <span className="cmdbar-status">
          <span className="dot-live" /> SISTEMA ONLINE
        </span>
        <Clock />
        <button className="cmdbar-exit" onClick={logout}>
          sair →
        </button>
      </header>

      {!loaded ? (
        <div className="loading">estabelecendo conexão com o garimpo…</div>
      ) : (
        <div className="deck">
          <aside className="opscol">
            <section>
              <div className="syslabel bignum-label">
                LINKS MINERADOS
              </div>
              <div className="bignum">{total}</div>
              <div className="bignum-sub">
                <b>+{today}</b> garimpados hoje
              </div>
            </section>

            <section>
              <div className="syslabel">ATIVIDADE · 7 DIAS</div>
              <div className="spark">
                {week.map((d, i) => (
                  <div
                    key={i}
                    className={`spark-bar ${d.today ? "today" : ""}`}
                    style={{
                      height: `${Math.max(7, (d.count / weekMax) * 100)}%`,
                    }}
                    title={`${d.label}: ${d.count}`}
                  />
                ))}
              </div>
              <div className="spark-legend">
                <span>{week[0].label}</span>
                <span>hoje</span>
              </div>
            </section>

            <section>
              <div className="syslabel">RANKING DE MINERADORES</div>
              <div className="rank">
                {ranking.length === 0 && (
                  <div className="rank-row">
                    <span className="rank-pos">--</span>
                    <span className="rank-name">aguardando garimpo_</span>
                  </div>
                )}
                {ranking.map(([who, n], i) => (
                  <div className="rank-row" key={who}>
                    <span className="rank-pos">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="rank-name">@{who}</span>
                    <span className="rank-n">{n}</span>
                    <span className="rank-bar">
                      <i style={{ width: `${(n / rankMax) * 100}%` }} />
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <div className="opscol-foot">
              FONTE <span>bot whatsapp/telegram</span>
              <br />
              SYNC <span>a cada 5s</span>
              <br />
              DB <span>supabase · online</span>
            </div>
          </aside>

          <main className="stage">
            <nav className="tabs">
              <button
                className={`tab ${selected === "all" ? "active" : ""}`}
                onClick={() => setSelected("all")}
              >
                <span className="tab-name">todas</span>
                <span className="tab-n">{links.length}</span>
              </button>
              {folders.map((f) => (
                <button
                  key={f.id}
                  className={`tab ${selected === f.id ? "active" : ""}`}
                  onClick={() => setSelected(f.id)}
                >
                  <span className="tab-name">#{f.name}</span>
                  <span className="tab-n">{f.count}</span>
                  {selected === f.id && f.name !== "inbox" && (
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
                        className="icon-btn"
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
                </button>
              ))}
              <form className="tab-new" onSubmit={createFolder}>
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
            </nav>

            <div className="stagebar">
              <span className="stage-title">{selectedName}</span>
              <span className="stage-count">
                {visible.length} registro(s)
              </span>
              <input
                className="input stage-search"
                placeholder="buscar url, @minerador, pasta_"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="feed">
              {visible.length === 0 ? (
                <div className="empty">
                  <div className="empty-title">SETOR VAZIO</div>
                  <p>
                    manda um link no grupo do bot que ele aparece aqui
                    ao vivo
                    <br />
                    usa <code>#pasta</code> na mensagem pra cair direto
                    no lugar certo_
                  </p>
                </div>
              ) : (
                visible.map((l) => {
                  const p = platformOf(l.url);
                  return (
                    <div
                      className={`row ${freshIds.has(l.id) ? "fresh" : ""}`}
                      key={l.id}
                    >
                      <span className={`badge ${p.cls}`}>{p.label}</span>
                      <div className="row-main">
                        <a
                          className="row-url"
                          href={l.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {shortUrl(l.url)}
                        </a>
                        <div className="row-meta">
                          <span className="f">#{l.folder}</span>
                          {l.added_by && <span>@{l.added_by}</span>}
                          <span>{timeAgo(l.created_at)}</span>
                        </div>
                      </div>
                      <div className="row-acts">
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
                  );
                })
              )}
            </div>
          </main>
        </div>
      )}

      <footer className="ticker">
        <span className="ticker-tag">FEED_AO_VIVO</span>
        <div className="ticker-view">
          {latest.length > 0 && (
            <div className="ticker-track">
              {[...latest, ...latest].map((l, i) => (
                <span className="tk" key={`${l.id}-${i}`}>
                  <b>{shortUrl(l.url).slice(0, 52)}</b>
                  <span className="f">#{l.folder}</span>
                  {l.added_by && <span>@{l.added_by}</span>}
                  <span>{timeAgo(l.created_at)}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </footer>

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
