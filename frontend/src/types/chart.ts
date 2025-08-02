export type ChartType = 'bar' | 'line' | 'scatter' | 'histogram' | 'boxplot' | 'pie' | 'doughnut';

export interface ChartData {
  labels: string[];
  datasets: ChartDataset[];
}

export interface ChartDataset {
  label: string;
  data: number[];
  backgroundColor?: string | string[];
  borderColor?: string | string[];
  borderWidth?: number;
  fill?: boolean;
  tension?: number;
  pointRadius?: number;
  pointHoverRadius?: number;
}

export interface ChartStyling {
  colors: string[];
  backgroundColor?: string;
  borderColor?: string;
  borderWidth?: number;
  fontSize?: number;
  fontFamily?: string;
  gridColor?: string;
  tickColor?: string;
}

export interface ChartAxis {
  display: boolean;
  title: {
    display: boolean;
    text: string;
    color?: string;
    font?: {
      size: number;
      family: string;
      weight: string;
    };
  };
  grid: {
    display: boolean;
    color: string;
  };
  ticks: {
    color: string;
    font?: {
      size: number;
    };
  };
}

export interface ChartLegend {
  display: boolean;
  position: 'top' | 'bottom' | 'left' | 'right';
  labels: {
    color: string;
    font?: {
      size: number;
    };
  };
}

export interface ChartTooltip {
  enabled: boolean;
  backgroundColor: string;
  titleColor: string;
  bodyColor: string;
  borderColor: string;
  borderWidth: number;
}

export interface InteractivityOptions {
  hover: boolean;
  click: boolean;
  zoom: boolean;
  pan: boolean;
}

export interface ChartConfiguration {
  id: string;
  type: ChartType;
  title: string;
  data: ChartData;
  styling: ChartStyling;
  xAxis: ChartAxis;
  yAxis: ChartAxis;
  legend: ChartLegend;
  tooltip: ChartTooltip;
  interactivity: InteractivityOptions;
  responsive: boolean;
  maintainAspectRatio: boolean;
}

export interface ExportOptions {
  format: 'png' | 'svg' | 'pdf';
  width: number;
  height: number;
  quality?: number;
  backgroundColor?: string;
}

export interface DashboardLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  charts: ChartConfiguration[];
  layout: DashboardLayout[];
  filters: FilterConfiguration[];
  createdAt: Date;
  updatedAt: Date;
}

export interface FilterConfiguration {
  id: string;
  name: string;
  type: 'select' | 'range' | 'date' | 'text';
  column: string;
  values?: string[];
  min?: number;
  max?: number;
  defaultValue?: any;
}

export interface ChartExportResult {
  success: boolean;
  data?: string; // base64 encoded data
  error?: string;
}