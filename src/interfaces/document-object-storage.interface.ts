import type { StoredObject } from './stored-object.interface';

export interface DocumentObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  presignDownload(key: string, filename: string, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<StoredObject[]>;
}