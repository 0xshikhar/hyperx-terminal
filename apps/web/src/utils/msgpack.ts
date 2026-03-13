/**
 * Binary Message Protocol (msgpack)
 * 
 * Lightweight msgpack encoder optimized for trading data.
 * See docs/phase1/index.md for implementation details and benchmarks.
 */

// Format: [type: uint8, ...data]
// Types: 0=null, 1=bool, 2=int, 3=float, 4=string, 5=array, 6=object

const MSGPACK_TYPES = {
  NULL: 0,
  BOOL: 1,
  INT: 2,
  FLOAT: 3,
  STRING: 4,
  ARRAY: 5,
  OBJECT: 6,
} as const;

export function encode(value: unknown): Uint8Array {
  const chunks: Uint8Array[] = [];
  
  function encodeValue(val: unknown): void {
    if (val === null) {
      chunks.push(new Uint8Array([MSGPACK_TYPES.NULL]));
    } else if (typeof val === "boolean") {
      chunks.push(new Uint8Array([MSGPACK_TYPES.BOOL, val ? 1 : 0]));
    } else if (typeof val === "number") {
      if (Number.isInteger(val) && val >= -2147483648 && val <= 2147483647) {
        // 32-bit integer
        const buffer = new ArrayBuffer(5);
        const view = new DataView(buffer);
        view.setUint8(0, MSGPACK_TYPES.INT);
        view.setInt32(1, val, true); // little-endian
        chunks.push(new Uint8Array(buffer));
      } else {
        // Float64
        const buffer = new ArrayBuffer(9);
        const view = new DataView(buffer);
        view.setUint8(0, MSGPACK_TYPES.FLOAT);
        view.setFloat64(1, val, true);
        chunks.push(new Uint8Array(buffer));
      }
    } else if (typeof val === "string") {
      const encoder = new TextEncoder();
      const strBytes = encoder.encode(val);
      const lenBuffer = new ArrayBuffer(5);
      const lenView = new DataView(lenBuffer);
      lenView.setUint8(0, MSGPACK_TYPES.STRING);
      lenView.setUint32(1, strBytes.length, true);
      chunks.push(new Uint8Array(lenBuffer));
      chunks.push(strBytes);
    } else if (Array.isArray(val)) {
      const lenBuffer = new ArrayBuffer(5);
      const lenView = new DataView(lenBuffer);
      lenView.setUint8(0, MSGPACK_TYPES.ARRAY);
      lenView.setUint32(1, val.length, true);
      chunks.push(new Uint8Array(lenBuffer));
      for (const item of val) {
        encodeValue(item);
      }
    } else if (typeof val === "object") {
      const entries = Object.entries(val);
      const lenBuffer = new ArrayBuffer(5);
      const lenView = new DataView(lenBuffer);
      lenView.setUint8(0, MSGPACK_TYPES.OBJECT);
      lenView.setUint32(1, entries.length, true);
      chunks.push(new Uint8Array(lenBuffer));
      for (const [key, value] of entries) {
        encodeValue(key);
        encodeValue(value);
      }
    }
  }
  
  encodeValue(value);
  
  // Merge chunks
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  
  return result;
}

/**
 * Decode binary format to JavaScript value
 */
export function decode(buffer: Uint8Array): unknown {
  let offset = 0;
  
  function decodeValue(): unknown {
    if (offset >= buffer.length) return null;
    
    const type = buffer[offset++];
    
    switch (type) {
      case MSGPACK_TYPES.NULL:
        return null;
        
      case MSGPACK_TYPES.BOOL:
        return buffer[offset++] === 1;
        
      case MSGPACK_TYPES.INT:
        const intVal = new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getInt32(0, true);
        offset += 4;
        return intVal;
        
      case MSGPACK_TYPES.FLOAT:
        const floatVal = new DataView(buffer.buffer, buffer.byteOffset + offset, 8).getFloat64(0, true);
        offset += 8;
        return floatVal;
        
      case MSGPACK_TYPES.STRING:
        const strLen = new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getUint32(0, true);
        offset += 4;
        const strBytes = buffer.slice(offset, offset + strLen);
        offset += strLen;
        return new TextDecoder().decode(strBytes);
        
      case MSGPACK_TYPES.ARRAY:
        const arrLen = new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getUint32(0, true);
        offset += 4;
        const arr: unknown[] = [];
        for (let i = 0; i < arrLen; i++) {
          arr.push(decodeValue());
        }
        return arr;
        
      case MSGPACK_TYPES.OBJECT:
        const objLen = new DataView(buffer.buffer, buffer.byteOffset + offset, 4).getUint32(0, true);
        offset += 4;
        const obj: Record<string, unknown> = {};
        for (let i = 0; i < objLen; i++) {
          const key = decodeValue() as string;
          const value = decodeValue();
          obj[key] = value;
        }
        return obj;
        
      default:
        throw new Error(`Unknown msgpack type: ${type}`);
    }
  }
  
  return decodeValue();
}

/**
 * Orderbook-optimized binary format
 * Format: [version:1][market_len:1][market:N][timestamp:8][sequence:4][bids_count:2][asks_count:2][levels...]
 * Level: [price:8][size:8] (both Float64)
 */
export interface OrderbookSnapshot {
  market: string;
  bids: Array<{ price: number; size: number }>;
  asks: Array<{ price: number; size: number }>;
  timestamp: number;
  sequence: number;
}

export function encodeOrderbook(snapshot: OrderbookSnapshot): Uint8Array {
  const encoder = new TextEncoder();
  const marketBytes = encoder.encode(snapshot.market);
  
  // Header: version(1) + market_len(1) + market(N) + timestamp(8) + sequence(4) + bids_count(2) + asks_count(2)
  const headerSize = 1 + 1 + marketBytes.length + 8 + 4 + 2 + 2;
  const levelSize = 8 + 8; // price(f64) + size(f64)
  const totalSize = headerSize + (snapshot.bids.length + snapshot.asks.length) * levelSize;
  
  const buffer = new ArrayBuffer(totalSize);
  const view = new DataView(buffer);
  let offset = 0;
  
  // Version
  view.setUint8(offset++, 1);
  
  // Market
  view.setUint8(offset++, marketBytes.length);
  new Uint8Array(buffer, offset, marketBytes.length).set(marketBytes);
  offset += marketBytes.length;
  
  // Timestamp
  view.setFloat64(offset, snapshot.timestamp, true);
  offset += 8;
  
  // Sequence
  view.setUint32(offset, snapshot.sequence, true);
  offset += 4;
  
  // Bid count
  view.setUint16(offset, snapshot.bids.length, true);
  offset += 2;
  
  // Ask count
  view.setUint16(offset, snapshot.asks.length, true);
  offset += 2;
  
  // Bids
  for (const bid of snapshot.bids) {
    view.setFloat64(offset, bid.price, true);
    offset += 8;
    view.setFloat64(offset, bid.size, true);
    offset += 8;
  }
  
  // Asks
  for (const ask of snapshot.asks) {
    view.setFloat64(offset, ask.price, true);
    offset += 8;
    view.setFloat64(offset, ask.size, true);
    offset += 8;
  }
  
  return new Uint8Array(buffer);
}

export function decodeOrderbook(buffer: Uint8Array): OrderbookSnapshot {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let offset = 0;
  
  // Version (skip for now, could use for future format changes)
  offset++;
  
  // Market
  const marketLen = view.getUint8(offset++);
  const marketBytes = buffer.slice(offset, offset + marketLen);
  const market = new TextDecoder().decode(marketBytes);
  offset += marketLen;
  
  // Timestamp
  const timestamp = view.getFloat64(offset, true);
  offset += 8;
  
  // Sequence
  const sequence = view.getUint32(offset, true);
  offset += 4;
  
  // Counts
  const bidCount = view.getUint16(offset, true);
  offset += 2;
  const askCount = view.getUint16(offset, true);
  offset += 2;
  
  // Parse levels
  const bids: Array<{ price: number; size: number }> = [];
  const asks: Array<{ price: number; size: number }> = [];
  
  for (let i = 0; i < bidCount; i++) {
    bids.push({
      price: view.getFloat64(offset, true),
      size: view.getFloat64(offset + 8, true),
    });
    offset += 16;
  }
  
  for (let i = 0; i < askCount; i++) {
    asks.push({
      price: view.getFloat64(offset, true),
      size: view.getFloat64(offset + 8, true),
    });
    offset += 16;
  }
  
  return { market, bids, asks, timestamp, sequence };
}

export function benchmark(data: unknown): { json: number; msgpack: number; ratio: number } {
  const iterations = 1000;
  
  // JSON benchmark
  const jsonStart = performance.now();
  let jsonSize = 0;
  for (let i = 0; i < iterations; i++) {
    const json = JSON.stringify(data);
    jsonSize = json.length;
    JSON.parse(json);
  }
  const jsonTime = performance.now() - jsonStart;
  
  // Msgpack benchmark
  const mpStart = performance.now();
  let mpSize = 0;
  for (let i = 0; i < iterations; i++) {
    const encoded = encode(data);
    mpSize = encoded.length;
    decode(encoded);
  }
  const mpTime = performance.now() - mpStart;
  
  // Log sizes for debugging (will be tree-shaken in production if not used)
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`JSON: ${jsonSize} bytes, Msgpack: ${mpSize} bytes, Ratio: ${(jsonSize / mpSize).toFixed(2)}x`);
  }
  
  return {
    json: jsonTime,
    msgpack: mpTime,
    ratio: jsonTime / mpTime,
  };
}
