import Dexie, { type Table } from 'dexie';

export interface ParkingLocation {
  id?: number; // Auto-incremented primary key for Dexie is easier with numbers or we can use string UUIDs
  uuid: string; // Sticking to string id for compatibility with the spec, but keeping dexie PK as ++id
  title: string;
  latitude: number;
  longitude: number;
  note: string;
  image?: Blob;
  createdAt: number;
}

export interface PDFSignature {
  id?: number;
  name: string;
  imageBlob: string;
  createdAt: number;
}

export interface PDFTextSnippet {
  id?: number;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  createdAt: number;
}

export class HandyToolsDatabase extends Dexie {
  parkingLocations!: Table<ParkingLocation>;
  pdfSignatures!: Table<PDFSignature>;
  pdfTexts!: Table<PDFTextSnippet>;

  constructor() {
    super('HandyToolsDB');
    this.version(1).stores({
      parkingLocations: '++id, uuid, title, createdAt' // Primary key and indexed props
    });
    this.version(2).stores({
      parkingLocations: '++id, uuid, title, createdAt',
      pdfSignatures: '++id, name, createdAt',
      pdfTexts: '++id, text, createdAt'
    });
  }
}

export const db = new HandyToolsDatabase();
