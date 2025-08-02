export interface Dataset {
  id: string;
  name: string;
  columns: ColumnInfo[];
  rowCount: number;
  fileSize: number;
  uploadedAt: string;
  userId: string;
}

export interface ColumnInfo {
  name: string;
  dataType: 'numeric' | 'categorical' | 'date' | 'text';
  missingValues: number;
  uniqueValues: number;
  statistics?: DescriptiveStats;
}

export interface DescriptiveStats {
  mean: number;
  median: number;
  mode: number[];
  standardDeviation: number;
  variance: number;
  min: number;
  max: number;
  quartiles: [number, number, number];
}

export interface DataRow {
  [key: string]: any;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export interface FileUploadResponse {
  dataset: Dataset;
  preview: DataRow[];
}