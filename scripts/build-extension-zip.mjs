/**
 * Empacota extension/ em public/viralhunter-extensao.zip.
 *
 * Roda no prebuild, então o arquivo servido é sempre o código que está no
 * repositório — um zip commitado à mão sairia de sincronia na primeira
 * alteração que alguém esquecesse de reempacotar.
 *
 * ZIP escrito à mão com zlib porque o formato é simples e não vale uma
 * dependência nova só para isto.
 */

import { deflateRawSync, crc32 } from "node:zlib";
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, relative, sep } from "node:path";

const SRC = "extension";
const OUT = join("public", "viralhunter-extensao.zip");
/** pasta raiz dentro do zip: quem descompacta recebe uma pasta nomeada */
const ROOT = "viralhunter-extensao";

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (entry === ".DS_Store") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

/** data/hora no formato MS-DOS que o ZIP usa */
function dosDateTime(d) {
  const time =
    (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const date =
    ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return { time, date };
}

function build() {
  const files = walk(SRC).sort();
  if (files.length === 0) throw new Error(`nada em ${SRC}/`);

  const now = new Date();
  const { time, date } = dosDateTime(now);
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const file of files) {
    const data = readFileSync(file);
    const name = `${ROOT}/${relative(SRC, file).split(sep).join("/")}`;
    const nameBuf = Buffer.from(name, "utf8");
    const compressed = deflateRawSync(data, { level: 9 });
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // assinatura
    local.writeUInt16LE(20, 4); // versão mínima
    local.writeUInt16LE(0x0800, 6); // flag: nome em UTF-8
    local.writeUInt16LE(8, 8); // método: deflate
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28); // sem campo extra

    chunks.push(local, nameBuf, compressed);

    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4); // versão que criou
    dir.writeUInt16LE(20, 6); // versão mínima
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt16LE(8, 10);
    dir.writeUInt16LE(time, 12);
    dir.writeUInt16LE(date, 14);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(compressed.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(nameBuf.length, 28);
    dir.writeUInt16LE(0, 30); // extra
    dir.writeUInt16LE(0, 32); // comentário
    dir.writeUInt16LE(0, 34); // disco
    dir.writeUInt16LE(0, 36); // atributos internos
    // atributos externos (unix 644). `>>> 0` porque o shift de 32 bits do JS
    // devolve negativo e writeUInt32LE recusa
    dir.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, nameBuf);

    offset += local.length + nameBuf.length + compressed.length;
  }

  const centralBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4); // disco
  end.writeUInt16LE(0, 6); // disco do início do diretório
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralBuf.length, 12);
  end.writeUInt32LE(offset, 16); // início do diretório central
  end.writeUInt16LE(0, 20); // comentário

  mkdirSync("public", { recursive: true });
  writeFileSync(OUT, Buffer.concat([...chunks, centralBuf, end]));

  const kb = (statSync(OUT).size / 1024).toFixed(1);
  console.log(`extensão empacotada: ${OUT} (${files.length} arquivos, ${kb} kB)`);
}

build();
