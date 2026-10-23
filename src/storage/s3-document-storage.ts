import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { ServiceUnavailableError } from '../errors/app-error';
import { contentDispositionFilename } from './file-validation';
import { s3Client } from './s3-client';

export interface StoredObject {
  key: string;
  lastModified?: Date;
}

export interface DocumentObjectStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  presignDownload(key: string, filename: string, contentType: string): Promise<string>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<StoredObject[]>;
}

export class S3DocumentStorage implements DocumentObjectStorage {
  constructor(private readonly client: S3Client = s3Client) {}

  async put(key: string, body: Buffer, contentType: string): Promise<void> {
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: env.DOCUMENTS_S3_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        ServerSideEncryption: 'AES256',
      }));
    } catch {
      throw new ServiceUnavailableError('Document storage is temporarily unavailable');
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({
        Bucket: env.DOCUMENTS_S3_BUCKET,
        Key: key,
      }));
      return true;
    } catch (error) {
      const s3Error = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (s3Error.name === 'NotFound' || s3Error.name === 'NoSuchKey' || s3Error.$metadata?.httpStatusCode === 404) {
        return false;
      }
      throw new ServiceUnavailableError('Document storage is temporarily unavailable');
    }
  }

  async presignDownload(key: string, filename: string, contentType: string): Promise<string> {
    try {
      return await getSignedUrl(this.client, new GetObjectCommand({
        Bucket: env.DOCUMENTS_S3_BUCKET,
        Key: key,
        ResponseContentDisposition: contentDispositionFilename(filename),
        ResponseContentType: contentType,
      }), { expiresIn: env.DOCUMENT_DOWNLOAD_URL_TTL_SECONDS });
    } catch {
      throw new ServiceUnavailableError('Document storage is temporarily unavailable');
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: env.DOCUMENTS_S3_BUCKET, Key: key }));
    } catch {
      throw new ServiceUnavailableError('Document storage is temporarily unavailable');
    }
  }

  async list(prefix: string): Promise<StoredObject[]> {
    try {
      const objects: StoredObject[] = [];
      let continuationToken: string | undefined;
      do {
        const response = await this.client.send(new ListObjectsV2Command({
          Bucket: env.DOCUMENTS_S3_BUCKET,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }));
        for (const object of response.Contents ?? []) {
          if (object.Key) objects.push({ key: object.Key, lastModified: object.LastModified });
        }
        continuationToken = response.NextContinuationToken;
      } while (continuationToken);
      return objects;
    } catch {
      throw new ServiceUnavailableError('Document storage is temporarily unavailable');
    }
  }
}