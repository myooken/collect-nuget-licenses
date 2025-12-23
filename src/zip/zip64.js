import { decodeSmart } from "../encoding.js";
import { MAX_COMMENT, MAX_SAFE_BIG, SIG_EOCD, SIG_Z64_EOCD, SIG_Z64_LOC, SIG_CEN } from "./constants.js";
import { u16, u32, u64, inRange, decodeName } from "./buffers.js";

const warnDefault = (msg) => console.warn(msg);

export function findEocd(buf) {
  const minPos = Math.max(0, buf.length - (22 + MAX_COMMENT));
  for (let i = buf.length - 22; i >= minPos; i--) {
    if (!inRange(buf, i, 22)) continue;
    if (u32(buf, i) !== SIG_EOCD) continue;

    const commentLen = u16(buf, i + 20);
    if (i + 22 + commentLen !== buf.length) continue;

    const cdSize32 = u32(buf, i + 12);
    const cdOffset32 = u32(buf, i + 16);
    if (cdOffset32 > buf.length || cdSize32 > buf.length) continue;
    if (cdOffset32 + cdSize32 > i) continue;
    const diskNo = u16(buf, i + 4);
    const cdDiskNo = u16(buf, i + 6);
    if (diskNo !== 0 || cdDiskNo !== 0) continue;

    return i;
  }
  return -1;
}

export function tryReadZip64(buf, eocdOffset, warn = warnDefault) {
  const scanBack = Math.min(1024, eocdOffset);
  let locOff = -1;
  for (let i = eocdOffset - 20; i >= eocdOffset - scanBack; i--) {
    if (!inRange(buf, i, 20)) continue;
    if (u32(buf, i) === SIG_Z64_LOC) { locOff = i; break; }
  }
  if (locOff === -1) return null;

  const z64EocdOffBig = u64(buf, locOff + 8);
  const diskWithZ64 = u32(buf, locOff + 4);
  const totalDisks = u32(buf, locOff + 16);
  if (diskWithZ64 !== 0 || totalDisks !== 1) {
    warn("zip: multi-disk Zip64 is not supported; skipping.");
    return null;
  }
  if (z64EocdOffBig > MAX_SAFE_BIG) {
    warn("zip: Zip64 EOCD offset exceeds JS safe integer; skipping.");
    return null;
  }
  const z64EocdOff = Number(z64EocdOffBig);
  if (!inRange(buf, z64EocdOff, 56)) {
    warn("zip: Zip64 EOCD record is out of range; skipping.");
    return null;
  }
  if (u32(buf, z64EocdOff) !== SIG_Z64_EOCD) {
    warn("zip: Zip64 EOCD signature not found; skipping.");
    return null;
  }

  const recordSizeBig = u64(buf, z64EocdOff + 4);
  if (recordSizeBig > MAX_SAFE_BIG) {
    warn("zip: Zip64 EOCD record too large; skipping.");
    return null;
  }
  const recordSize = Number(recordSizeBig);
  const fullSize = 12 + recordSize;
  if (!inRange(buf, z64EocdOff, fullSize)) {
    warn("zip: Zip64 EOCD record truncated; skipping.");
    return null;
  }

  const diskNo = u32(buf, z64EocdOff + 16);
  const cdDiskNo = u32(buf, z64EocdOff + 20);
  if (diskNo !== 0 || cdDiskNo !== 0) {
    warn("zip: Zip64 multi-disk fields detected; skipping.");
    return null;
  }

  const totalEntriesBig = u64(buf, z64EocdOff + 32);
  const cdSizeBig = u64(buf, z64EocdOff + 40);
  const cdOffsetBig = u64(buf, z64EocdOff + 48);
  if (totalEntriesBig > MAX_SAFE_BIG || cdSizeBig > MAX_SAFE_BIG || cdOffsetBig > MAX_SAFE_BIG) {
    warn("zip: Zip64 values exceed JS safe integer; skipping.");
    return null;
  }

  return {
    total: Number(totalEntriesBig),
    cdSize: Number(cdSizeBig),
    cdOffset: Number(cdOffsetBig),
  };
}

export function applyZip64Extra(buf, extraOff, extraLen, entry, warn = warnDefault) {
  let p = extraOff;
  const end = extraOff + extraLen;

  while (p + 4 <= end) {
    const headerId = u16(buf, p);
    const dataSize = u16(buf, p + 2);
    const dataOff = p + 4;
    const dataEnd = dataOff + dataSize;
    if (dataEnd > end) break;

    if (headerId === 0x0001) {
      let q = dataOff;
      const needUncomp = entry.uncompSize === 0xffffffff;
      const needComp = entry.compSize === 0xffffffff;
      const needLoc = entry.localOffset === 0xffffffff;

      if (needUncomp && q + 8 <= dataEnd) entry.uncompSize64 = u64(buf, q), (q += 8);
      if (needComp && q + 8 <= dataEnd) entry.compSize64 = u64(buf, q), (q += 8);
      if (needLoc && q + 8 <= dataEnd) entry.localOffset64 = u64(buf, q), (q += 8);

      if (entry.uncompSize64 != null) entry.uncompSize = Number(entry.uncompSize64);
      if (entry.compSize64 != null) entry.compSize = Number(entry.compSize64);
      if (entry.localOffset64 != null) entry.localOffset = Number(entry.localOffset64);
      return;
    }
    p = dataEnd;
  }
}

export function isLicensePath(name) {
  const base = name.split("/").at(-1) || "";
  return LICENSE_BASENAME_RE.test(base);
}
