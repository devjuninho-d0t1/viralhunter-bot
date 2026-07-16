# Product

## Register

product

## Users

Time de "mineradores" de conteúdo viral (5-15 pessoas, BR, mobile-first no WhatsApp, desktop no painel). Eles jogam links de reels/tiktoks num grupo do bot o dia inteiro; o painel é onde o time e o gestor (Rodrigo/Juninho) veem o garimpo consolidado, organizam pastas e decidem o que replicar. Contexto de uso: sala de operação de conteúdo, várias vezes ao dia, sessões curtas e intensas.

## Product Purpose

VIRALHUNTER é o terminal de operações do garimpo: tudo que entra pelo bot (WhatsApp/Telegram) aparece aqui ao vivo, organizado em pastas. Sucesso = o time sente que está numa sala de controle (dados pulsando, ranking, atividade), não numa lista de favoritos. A plataforma é espelho e cockpit do bot.

## Brand Personality

Arcade-operacional, denso, confiante. Herda a identidade do viral.doti.gg (produto-mãe): verde-preto profundo, volt #d9ff4a, pixel font como assinatura, mono como voz. Tom em pt-BR informal com underscore no fim das frases-chave ("nada por aqui ainda_").

## Anti-references

- O painel v1 deste próprio projeto: cards pequenos, lista tímida, dashboard genérico de SaaS ("hero-metric + card grid"). Foi rejeitado pelo usuário como "design porco".
- Dashboards admin template (shadcn default, Bootstrap admin, Tremor default).
- Glassmorphism decorativo e gradientes roxos.

## Design Principles

1. **Sala de controle, não lista** — densidade de informação é feature: números grandes, ranking, ticker, atividade ao vivo. Tela cheia, sem timidez.
2. **O dado pulsa** — tudo que muda deve parecer vivo: contadores, dot pulsante, novos links entrando com destaque. Polling de 5s é o coração.
3. **Volt é sinal, não decoração** — #d9ff4a marca o que importa agora (números, ativo, novo); verde #22c55e é estado saudável; o resto fica no escuro.
4. **Identidade doti.gg inegociável** — pixel font, mono, verde-preto. Quem conhece o viral.doti.gg reconhece a família na hora.
5. **Gestão sem cerimônia** — criar/renomear/apagar/mover em 1-2 cliques, direto no lugar, sem modais desnecessários.

## Accessibility & Inclusion

Contraste mínimo 4.5:1 no texto corrente (volt sobre preto passa folgado; cuidar dos muted). `prefers-reduced-motion` desliga ticker/pulso/count-up. Alvos de toque ≥40px no mobile (o gestor abre no celular).
