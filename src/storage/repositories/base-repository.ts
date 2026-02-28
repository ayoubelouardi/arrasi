import type { Table } from 'dexie'

export interface CrudRepository<T extends { id: string }> {
  getById(id: string): Promise<T | undefined>
  getAll(): Promise<T[]>
  put(entity: T): Promise<string>
  bulkPut(entities: T[]): Promise<void>
  deleteById(id: string): Promise<void>
  clear(): Promise<void>
}

export class BaseRepository<T extends { id: string }> implements CrudRepository<T> {
  constructor(private readonly table: Table<T, string>) {}

  getById(id: string) {
    return this.table.get(id)
  }

  getAll() {
    return this.table.toArray()
  }

  put(entity: T) {
    return this.table.put(entity)
  }

  async bulkPut(entities: T[]) {
    await this.table.bulkPut(entities)
  }

  async deleteById(id: string) {
    await this.table.delete(id)
  }

  async clear() {
    await this.table.clear()
  }
}
