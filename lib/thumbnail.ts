/**
 * Resolvedor de capa (primeiro frame) dos vídeos, pra vitrine 9:16.
 *
 * Estratégia por plataforma:
 *  - YouTube  → thumbnail direta pelo id do vídeo (grátis, instantâneo)
 *  - TikTok   → oEmbed oficial (thumbnail_url)
 *  - Instagram e resto → Microlink (lê og:image / capa)
 *
 * A imagem resolvida é BAIXADA e re-hospedada no Supabase Storage (bucket
 * público "thumbs"), porque as URLs de CDN do Instagram são assinadas e
 * expiram. A nossa cópia é permanente.
 */

const YT_RE =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;

function youtubeId(url: string): string | null {
  const m = url.match(YT_RE);
  return m ? m[1] : null;
}

async function resolveSource(url: string): Promise<string | null> {
  const yt = youtubeId(url);
  if (yt) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;

  if (/tiktok\.com/i.test(url)) {
    try {
      const r = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (r.ok) {
        const j = await r.json();
        if (j?.thumbnail_url) return j.thumbnail_url as string;
      }
    } catch {
      /* cai no microlink */
    }
  }

  // Instagram, Kwai, X e qualquer outro: Microlink lê a capa
  try {
    const r = await fetch(
      `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (r.ok) {
      const j = await r.json();
      const img = j?.data?.image?.url;
      if (img) return img as string;
    }
  } catch {
    /* falhou */
  }
  return null;
}

export interface ThumbResult {
  status: "ok" | "failed";
  thumbnailUrl: string | null;
}

export async function resolveAndStore(
  linkId: number,
  url: string,
): Promise<ThumbResult> {
  const src = await resolveSource(url);
  if (!src) return { status: "failed", thumbnailUrl: null };

  let bytes: ArrayBuffer;
  let contentType = "image/jpeg";
  try {
    const r = await fetch(src, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) return { status: "failed", thumbnailUrl: null };
    contentType = (r.headers.get("content-type") || "image/jpeg").split(
      ";",
    )[0];
    bytes = await r.arrayBuffer();
    if (bytes.byteLength < 512) return { status: "failed", thumbnailUrl: null };
  } catch {
    return { status: "failed", thumbnailUrl: null };
  }

  const path = `${linkId}.jpg`;
  const up = await fetch(
    `${process.env.SUPABASE_URL}/storage/v1/object/thumbs/${path}`,
    {
      method: "POST",
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!up.ok) {
    console.error("thumb upload failed", up.status);
    return { status: "failed", thumbnailUrl: null };
  }

  // cache-buster pelo id garante que uma re-resolução atualize o preview
  const publicUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/thumbs/${path}?v=${Date.now()}`;
  return { status: "ok", thumbnailUrl: publicUrl };
}
