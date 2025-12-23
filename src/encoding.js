import { TextDecoder } from "node:util";

// BOM に応じて utf8 / utf16 を判定しつつ安全にデコードする
const utf8 = new TextDecoder("utf-8", { fatal: false });
const utf16le = new TextDecoder("utf-16le", { fatal: false });

function swapBeToLe(buf) {
  const out = Buffer.allocUnsafe(buf.length - 2);
  for (let i = 2; i + 1 < buf.length; i += 2) {
    out[i - 2] = buf[i + 1];
    out[i - 1] = buf[i];
  }
  if (buf.length % 2 === 1) out[out.length - 1] = buf[buf.length - 1];
  return out;
}

function detectBom(buf) {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) return { enc: "utf8", offset: 3 };
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return { enc: "utf16le", offset: 2 };
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) return { enc: "utf16be", offset: 2 };
  return { enc: "utf8", offset: 0 };
}

export function decodeSmart(buf) {
  if (!buf) return "";
  const { enc, offset } = detectBom(buf);
  if (enc === "utf16le") return utf16le.decode(buf.subarray(offset));
  if (enc === "utf16be") return utf16le.decode(swapBeToLe(buf));
  return utf8.decode(buf.subarray(offset));
}
