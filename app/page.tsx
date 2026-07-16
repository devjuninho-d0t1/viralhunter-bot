"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/platform/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/painel");
        return;
      }
      setError("ACESSO NEGADO — senha incorreta_");
    } catch {
      setError("erro de conexão. tenta de novo_");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-wrap">
      <div className="login-box">
        <div className="login-frame">
          <h1 className="pixel login-logo cursor-blink">VIRALHUNTER</h1>
          <p className="login-sub">
            terminal de operações do garimpo · acesso restrito
          </p>
          <form className="login-form" onSubmit={submit}>
            <label className="syslabel" htmlFor="pw">
              CREDENCIAL DO TIME
            </label>
            <input
              id="pw"
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
            />
            <p className="login-err">{error}</p>
            <button
              type="submit"
              className="btn btn-volt"
              disabled={loading || !password}
            >
              {loading ? "VERIFICANDO…" : "INICIAR SESSÃO →"}
            </button>
          </form>
          <div className="login-foot">
            <span>SYS.VIRALHUNTER</span>
            <span>v2.0</span>
          </div>
        </div>
      </div>
    </main>
  );
}
