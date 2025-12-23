import fs from "node:fs";
import zlib from "node:zlib";
import { decodeSmart } from "../encoding.js";
import { SIG_CEN, SIG_LOC } from "./constants.js";
import { u16, u32, inRange, decodeName } from "./buffers.js";
import { findEocd, tryReadZip64, applyZip64Extra, isLicensePath } from "./zip64.js";

const warnDefault = (msg) => console.warn(msg);

function readCentralDirectory(buf, eocdOffset, warn = warnDefault) {
  const diskNo = u16(buf, eocdOffset + 4);
  const cdDiskNo = u16(buf, eocdOffset + 6);
  const diskEntries = u16(buf, eocdOffset + 8);
  const total16 = u16(buf, eocdOffset + 10);
  const cdSize32 = u32(buf, eocdOffset + 12);
  const cdOffset32 = u32(buf, eocdOffset + 16);

  if (diskNo !== 0 || cdDiskNo !== 0) {
    warn("zip: multi-disk zip is not supported; skipping.");
    return { entries: [], zip64: false, skipped: true };
  }

  let total = total16;
  let cdOffset = cdOffset32;
  let cdSize = cdSize32;
  let zip64 = false;

  const isZip64Hint = total16 === 0xffff || cdOffset32 === 0xffffffff || cdSize32 === 0xffffffff || diskEntries === 0xffff;
  if (isZip64Hint) {
    const z = tryReadZip64(buf, eocdOffset, warn);
    if (!z) return { entries: [], zip64: true, skipped: true };
    zip64 = true;
    total = z.total;
    cdOffset = z.cdOffset;
    cdSize = z.cdSize;
  }

  if (!Number.isFinite(total) || total < 0) {
    warn("zip: invalid total entries; skipping.");
    return { entries: [], zip64, skipped: true };
  }
  if (!inRange(buf, cdOffset, 1)) {
    warn("zip: central directory offset out of range; skipping.");
    return { entries: [], zip64, skipped: true };
  }
  if (cdSize > 0 && (!inRange(buf, cdOffset, cdSize) || cdOffset + cdSize > eocdOffset)) {
    warn("zip: central directory range invalid; skipping.");
    return { entries: [], zip64, skipped: true };
  }

  const entries = [];
  let ptr = cdOffset;

  for (let i = 0; i < total; i++) {
    if (!inRange(buf, ptr, 46)) {
      warn("zip: central directory entry header truncated; stopping.");
      break;
    }
    if (u32(buf, ptr) !== SIG_CEN) {
      warn("zip: central directory signature mismatch; stopping.");
      break;
    }

    const gpFlag = u16(buf, ptr + 8);
    const compression = u16(buf, ptr + 10);
    const compSize = u32(buf, ptr + 20);
    const uncompSize = u32(buf, ptr + 24);
    const nameLen = u16(buf, ptr + 28);
    const extraLen = u16(buf, ptr + 30);
    const commentLen = u16(buf, ptr + 32);
    const localOffset = u32(buf, ptr + 42);

    const isUtf8 = (gpFlag & 0x0800) !== 0;

    const nameOff = ptr + 46;
    const extraOff = nameOff + nameLen;
    const commentOff = extraOff + extraLen;
    const next = commentOff + commentLen;

    if (!inRange(buf, nameOff, nameLen) || !inRange(buf, extraOff, extraLen) || !inRange(buf, commentOff, commentLen)) {
      warn("zip: central directory entry fields truncated; stopping.");
      break;
    }

    const name = decodeName(buf, nameOff, nameLen, isUtf8);
    const entry = { name, gpFlag, compression, compSize, uncompSize, localOffset };

    if (zip64 && (compSize === 0xffffffff || uncompSize === 0xffffffff || localOffset === 0xffffffff)) {
      applyZip64Extra(buf, extraOff, extraLen, entry, warn);
    }

    entries.push(entry);
    ptr = next;
  }

  return { entries, zip64, skipped: false };
}

function extractEntry(buf, entry, warn = warnDefault) {
  const localOff = entry.localOffset;
  if (!Number.isFinite(localOff) || localOff < 0) return null;
  if (!inRange(buf, localOff, 30)) return null;
  if (u32(buf, localOff) !== SIG_LOC) return null;

  const nameLen = u16(buf, localOff + 26);
  const extraLen = u16(buf, localOff + 28);
  const dataStart = localOff + 30 + nameLen + extraLen;
  const compSize = entry.compSize;
  const dataEnd = dataStart + compSize;
  if (!inRange(buf, dataStart, compSize)) {
    warn(`zip: entry data out of range "${entry.name}"`);
    return null;
  }

  const slice = buf.subarray(dataStart, dataEnd);

  if (entry.compression === 0) return slice;
  if (entry.compression === 8) {
    try {
      return zlib.inflateRawSync(slice);
    } catch (e) {
      warn(`zip: deflate failed "${entry.name}": ${e?.message || e}`);
      return null;
    }
  }

  warn(`zip: skip "${entry.name}" (unsupported compression ${entry.compression})`);
  return null;
}

export async function getLicenseTextsFromNupkg(nupkgPath) {
  if (!fs.existsSync(nupkgPath)) return [];
  const buf = await fs.promises.readFile(nupkgPath);

  const eocd = findEocd(buf);
  if (eocd === -1) return [];

  const warn = warnDefault;
  const { entries, zip64, skipped } = readCentralDirectory(buf, eocd, warn);
  if (skipped) return [];

  const results = [];
  for (const entry of entries) {
    if (!isLicensePath(entry.name)) continue;
    if (zip64 && (entry.compSize === 0xffffffff || entry.localOffset === 0xffffffff)) {
      warn(`zip: unresolved Zip64 sizes/offsets; skip "${entry.name}"`);
      continue;
    }
    const data = extractEntry(buf, entry, warn);
    if (!data) continue;
    results.push({ name: entry.name, text: decodeSmart(data) });
  }
  return results;
}
