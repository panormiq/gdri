/**
 * Champ extra ZIP 0x000A (NTFS) — Mtime / Atime / Ctime pour Windows à l’extraction.
 * @see https://pkware.cachefly.net/webdocs/casestudies/APPNOTE.TXT — 4.5.5
 */

const WINDOWS_TICK = 10000n;
const SEC_TO_UNIX_EPOCH = 11644473600n;

/**
 * @param {Date} date
 * @returns {Buffer}
 */
function dateToFileTime(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) {
    throw new Error('Date invalide pour NTFS extra field');
  }
  const secs = BigInt(Math.floor(d.getTime() / 1000)) + SEC_TO_UNIX_EPOCH;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(secs * WINDOWS_TICK);
  return buf;
}

/**
 * @param {Date} date
 * @returns {Buffer}
 */
function buildNtfsExtraField(date) {
  const ft = dateToFileTime(date);
  const attributeData = Buffer.concat([ft, ft, ft]);

  const reserved = Buffer.alloc(4, 0);
  const tag1 = Buffer.alloc(2);
  tag1.writeUInt16LE(0x0001, 0);
  const size1buf = Buffer.alloc(2);
  size1buf.writeUInt16LE(24, 0);

  const inner = Buffer.concat([reserved, tag1, size1buf, attributeData]);
  const header = Buffer.alloc(4);
  header.writeUInt16LE(0x000a, 0);
  header.writeUInt16LE(inner.length, 2);

  return Buffer.concat([header, inner]);
}

module.exports = { buildNtfsExtraField, dateToFileTime };
