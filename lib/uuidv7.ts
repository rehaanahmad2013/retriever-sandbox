import type { Id, UuidString } from "./id";

const hexTable: string[] = [];

for (let i = 0; i < 256; ++i) {
  hexTable.push(i < 0x10 ? "0" + i.toString(16) : i.toString(16));
}

function bytesToUuid(bytes: number[] | Uint8Array): string {
  return (
    (
      hexTable[bytes[0]!]! +
      hexTable[bytes[1]!]! +
      hexTable[bytes[2]!]! +
      hexTable[bytes[3]!]! +
      "-" +
      hexTable[bytes[4]!]! +
      hexTable[bytes[5]!]! +
      "-" +
      hexTable[bytes[6]!]! +
      hexTable[bytes[7]!]! +
      "-" +
      hexTable[bytes[8]!]! +
      hexTable[bytes[9]!]! +
      "-" +
      hexTable[bytes[10]!]! +
      hexTable[bytes[11]!]! +
      hexTable[bytes[12]!]! +
      hexTable[bytes[13]!]! +
      hexTable[bytes[14]!]! +
      hexTable[bytes[15]!]!
    )
      .toLowerCase()
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[7][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function validate<T extends UuidString = UuidString>(id: string): id is T {
  return UUID_RE.test(id);
}

export function generate<T extends Id<string> | UuidString = UuidString>(
  timestamp: number = Date.now()
): T {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw new RangeError(
      `Cannot generate UUID as timestamp must be a non-negative integer: timestamp ${timestamp}`
    );
  }
  view.setBigUint64(0, BigInt(timestamp) << BigInt(16));
  crypto.getRandomValues(bytes.subarray(6));
  view.setUint8(6, (view.getUint8(6) & 0b00001111) | 0b01110000);
  view.setUint8(8, (view.getUint8(8) & 0b00111111) | 0b10000000);
  return bytesToUuid(bytes) as T;
}

export function generatePlaceholder<T extends Id<string> | UuidString = UuidString>(
  timestamp: number = Date.now()
): T {
  const bytes = new Uint8Array(16);
  const view = new DataView(bytes.buffer);
  if (!Number.isInteger(timestamp) || timestamp < 0) {
    throw new RangeError(
      `Cannot generate UUID as timestamp must be a non-negative integer: timestamp ${timestamp}`
    );
  }
  view.setBigUint64(0, BigInt(timestamp) << BigInt(16));
  view.setUint8(6, (view.getUint8(6) & 0b00001111) | 0b01110000);
  view.setUint8(8, (view.getUint8(8) & 0b00111111) | 0b10000000);
  return bytesToUuid(bytes) as T;
}

export function extractTimestamp(uuid: UuidString): number {
  if (!validate(uuid as string)) {
    throw new TypeError(
      `Cannot extract timestamp because the UUID is not a valid UUIDv7: uuid is "${uuid}"`
    );
  }
  const timestampHex = uuid.slice(0, 8) + uuid.slice(9, 13);
  return parseInt(timestampHex, 16);
}

export function extractDate(uuid: UuidString): Date {
  return new Date(extractTimestamp(uuid));
}
