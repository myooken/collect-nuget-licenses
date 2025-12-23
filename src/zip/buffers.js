// Buffer helpers
export function u16(buf, off) { return buf.readUInt16LE(off); }
export function u32(buf, off) { return buf.readUInt32LE(off); }
export function u64(buf, off) { return buf.readBigUInt64LE(off); }

export function inRange(buf, off, len = 1) {
  return off >= 0 && len >= 0 && off + len <= buf.length;
}

export function decodeName(buf, offset, len, isUtf8) {
  const slice = buf.subarray(offset, offset + len);
  return isUtf8 ? slice.toString("utf8") : slice.toString("latin1");
}
