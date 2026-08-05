import Link from "next/link";

export const metadata = {
  title: "Extensão do Chrome — VIRALHUNTER",
};

const PASSOS_INSTALAR = [
  {
    titulo: "Baixe o arquivo",
    texto: "Use o botão acima. Vai salvar um .zip na sua pasta de downloads.",
  },
  {
    titulo: "Descompacte",
    texto:
      "Clique duas vezes no arquivo baixado. Vai virar uma pasta chamada viralhunter-extensao. Guarde essa pasta num lugar que você não vá apagar depois: se ela sumir, a extensão para de funcionar.",
  },
  {
    titulo: "Abra a página de extensões do Chrome",
    texto:
      "Digite chrome://extensions na barra de endereço e aperte Enter.",
  },
  {
    titulo: "Ligue o Modo do desenvolvedor",
    texto: "É a chave no canto superior direito da página.",
  },
  {
    titulo: "Clique em Carregar sem compactação",
    texto:
      "O botão aparece no canto superior esquerdo depois que você liga o Modo do desenvolvedor. Selecione a pasta viralhunter-extensao.",
  },
];

const PASSOS_CONFIGURAR = [
  {
    titulo: "Abra as opções",
    texto:
      "Na extensão que apareceu na lista, clique em Detalhes e depois em Opções da extensão.",
  },
  {
    titulo: "Conecte ao painel",
    texto:
      "Deixe o endereço como está, digite a mesma senha que você usa para entrar aqui e clique em Conectar.",
  },
  {
    titulo: "Diga quem você é",
    texto:
      "Preencha seu nome (é assim que você vai aparecer como autor dos vídeos), escolha a pasta padrão e clique em Salvar preferências.",
  },
];

export default function ExtensaoPage() {
  return (
    <main className="doc">
      <header className="doc-head">
        <Link href="/painel" className="doc-back">
          voltar ao painel
        </Link>
        <h1 className="pixel doc-title">EXTENSÃO DO CHROME</h1>
        <p className="doc-sub">
          Minera vídeos do Instagram, TikTok e YouTube com um clique, sem
          passar pelo WhatsApp.
        </p>
      </header>

      <a className="btn btn-volt doc-download" href="/viralhunter-extensao.zip" download>
        Baixar a extensão
      </a>

      <section className="doc-section">
        <h2 className="doc-h2">Instalar</h2>
        <p className="doc-lead">
          Leva cerca de dois minutos e é só uma vez.
        </p>
        <ol className="doc-steps">
          {PASSOS_INSTALAR.map((p) => (
            <li key={p.titulo}>
              <b>{p.titulo}</b>
              <span>{p.texto}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="doc-section">
        <h2 className="doc-h2">Configurar</h2>
        <ol className="doc-steps" start={PASSOS_INSTALAR.length + 1}>
          {PASSOS_CONFIGURAR.map((p) => (
            <li key={p.titulo}>
              <b>{p.titulo}</b>
              <span>{p.texto}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="doc-section">
        <h2 className="doc-h2">Usar</h2>
        <ul className="doc-list">
          <li>
            <b>Botão na página</b>
            <span>
              Abra qualquer vídeo e clique em Minerar, no canto inferior
              direito. Vai para a pasta padrão.
            </span>
          </li>
          <li>
            <b>Ícone da extensão</b>
            <span>
              Abre uma janelinha onde dá para escolher a pasta e escrever o
              insight antes de salvar.
            </span>
          </li>
          <li>
            <b>Atalho de teclado</b>
            <span>
              Ctrl+Shift+M no Windows, Command+Shift+M no Mac, para minerar a
              página em que você está.
            </span>
          </li>
        </ul>
        <p className="doc-note">
          O botão só aparece quando existe um vídeo na tela. Em página de
          perfil ele não aparece, porque perfil não é arquivado.
        </p>
      </section>

      <section className="doc-section">
        <h2 className="doc-h2">Se algo der errado</h2>
        <ul className="doc-list">
          <li>
            <b>O botão não aparece</b>
            <span>
              Recarregue a página. O Chrome só injeta a extensão em páginas
              abertas depois da instalação.
            </span>
          </li>
          <li>
            <b>Diz que não conectou</b>
            <span>
              Volte em Opções da extensão e confira a senha. É a mesma do
              painel.
            </span>
          </li>
          <li>
            <b>A extensão sumiu</b>
            <span>
              A pasta que você descompactou foi apagada ou movida. Baixe de
              novo e repita a instalação.
            </span>
          </li>
        </ul>
      </section>
    </main>
  );
}
