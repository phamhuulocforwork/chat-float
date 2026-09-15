import type { WindowRecord } from './types'

const records = new Map<
  string,
  WindowRecord[] & { args?: unknown[] }
>()

export function appendRecord(record: WindowRecord) {
  const bucket = records.get(record.id) ?? []
  bucket.push(record)
  records.set(record.id, bucket)
}

export function setWindowOpenArgs(id: string, args: unknown[]) {
  const bucket = records.get(id) ?? []
  bucket.args = args
  records.set(id, bucket)
}

export function takeRecords(id: string) {
  const bucket = records.get(id)
  records.delete(id)
  return bucket
}

export function clearRecords(id: string) {
  records.delete(id)
}
