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

export class HandyToolsDatabase extends Dexie {
  parkingLocations!: Table<ParkingLocation>;

  constructor() {
    super('HandyToolsDB');
    this.version(1).stores({
      parkingLocations: '++id, uuid, title, createdAt' // Primary key and indexed props
    });
  }
}

export const db = new HandyToolsDatabase();
