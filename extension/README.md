# Extensão ViralHunter (Chrome)

Minera vídeos do Instagram, TikTok e YouTube direto para o painel do time, sem
passar pelo WhatsApp.

## Instalar

A extensão não está publicada na Chrome Web Store — a instalação é local, e
cada pessoa do time faz uma vez:

1. Abra `chrome://extensions`
2. Ligue o **Modo do desenvolvedor** (canto superior direito)
3. Clique em **Carregar sem compactação** e escolha esta pasta (`extension/`)
4. Clique em **Opções** na extensão recém-instalada
5. Confirme o endereço do painel, informe a senha do time e clique em
   **Conectar**
6. Preencha seu nome (aparece como autor dos vídeos que você minerar) e, se
   quiser, escolha a pasta padrão

Funciona também no Edge, Brave e Opera, que usam o mesmo formato.

## Usar

**Botão flutuante** — em qualquer página de vídeo do Instagram, TikTok ou
YouTube aparece um botão "Minerar" no canto inferior direito. Um clique salva
na pasta padrão.

**Ícone da extensão** — abre o popup, onde dá para escolher a pasta e escrever
o insight antes de salvar.

**Atalho de teclado** — `Ctrl+Shift+M` (`Cmd+Shift+M` no Mac) minera a aba
atual na pasta padrão.

O botão só aparece em página de vídeo. Em perfil (`instagram.com/fulano`,
`youtube.com/@canal`) ele não aparece, pela mesma regra que o bot usa no
WhatsApp: referência de conta não vira card.

## Segurança

A senha do time é usada uma única vez, para conectar. Ela não fica salva: o
painel devolve uma credencial própria da extensão e é só ela que fica no
armazenamento do Chrome. Revogar o acesso de todas as instalações de uma vez
é trocar o `SESSION_SECRET` na Vercel.

## Requisitos no servidor

Nenhuma migração de banco. As rotas `/api/extension/auth` e
`/api/extension/folders` vieram junto com o código do painel; basta o deploy
estar atualizado.
