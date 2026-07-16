import Link from "next/link";

export default function NotFound() {
  return (
    <main className="login-wrap">
      <div className="login-box">
        <div className="login-frame">
          <div className="syslabel" style={{ marginBottom: 14 }}>
            erro // rota desconhecida
          </div>
          <h1 className="pixel" style={{ fontSize: 34, marginBottom: 10 }}>
            404
          </h1>
          <h2 className="pixel" style={{ fontSize: 12, marginBottom: 10 }}>
            SETOR NÃO ENCONTRADO
          </h2>
          <p className="login-sub cursor-blink">
            essa rota não existe no terminal
          </p>
          <Link href="/" className="btn btn-volt">
            ← voltar pro painel
          </Link>
        </div>
      </div>
    </main>
  );
}
