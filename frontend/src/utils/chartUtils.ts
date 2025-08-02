import { ChartConfiguration, ChartType, ChartData, ChartStyling, ExportOptions } from '../types/chart';

// Default color palette
export const DEFAULT_COLORS = [
  '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
  '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
];

// Generate default chart configuration
export const createDefaultChartConfig = (
  id: string,
  type: ChartType,
  title: string
): ChartConfiguration => ({
  id,
  type,
  title,
  data: {
    labels: [],
    datasets: []
  },
  styling: {
    colors: DEFAULT_COLORS,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 2,
    fontSize: 12,
    fontFamily: 'Arial, sans-serif',
    gridColor: 'rgba(0, 0, 0, 0.1)',
    tickColor: '#666'
  },
  xAxis: {
    display: true,
    title: {
      display: true,
      text: 'X Axis',
      color: '#666',
      font: {
        size: 14,
        family: 'Arial, sans-serif',
        weight: 'bold'
      }
    },
    grid: {
      display: true,
      color: 'rgba(0, 0, 0, 0.1)'
    },
    ticks: {
      color: '#666',
      font: {
        size: 12
      }
    }
  },
  yAxis: {
    display: true,
    title: {
      display: true,
      text: 'Y Axis',
      color: '#666',
      font: {
        size: 14,
        family: 'Arial, sans-serif',
        weight: 'bold'
      }
    },
    grid: {
      display: true,
      color: 'rgba(0, 0, 0, 0.1)'
    },
    ticks: {
      color: '#666',
      font: {
        size: 12
      }
    }
  },
  legend: {
    display: true,
    position: 'top',
    labels: {
      color: '#666',
      font: {
        size: 12
      }
    }
  },
  tooltip: {
    enabled: true,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    titleColor: '#fff',
    bodyColor: '#fff',
    borderColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1
  },
  interactivity: {
    hover: true,
    click: true,
    zoom: false,
    pan: false
  },
  responsive: true,
  maintainAspectRatio: true
});

// Convert data to Chart.js format
export const convertToChartJsData = (config: ChartConfiguration) => {
  const { data, styling } = config;
  
  return {
    labels: data.labels,
    datasets: data.datasets.map((dataset, index) => ({
      ...dataset,
      backgroundColor: dataset.backgroundColor || styling.colors[index % styling.colors.length],
      borderColor: dataset.borderColor || styling.colors[index % styling.colors.length],
      borderWidth: dataset.borderWidth || styling.borderWidth
    }))
  };
};

// Convert configuration to Chart.js options
export const convertToChartJsOptions = (config: ChartConfiguration) => {
  const { xAxis, yAxis, legend, tooltip, responsive, maintainAspectRatio } = config;
  
  return {
    responsive,
    maintainAspectRatio,
    plugins: {
      legend: {
        display: legend.display,
        position: legend.position,
        labels: {
          color: legend.labels.color,
          font: legend.labels.font
        }
      },
      tooltip: {
        enabled: tooltip.enabled,
        backgroundColor: tooltip.backgroundColor,
        titleColor: tooltip.titleColor,
        bodyColor: tooltip.bodyColor,
        borderColor: tooltip.borderColor,
        borderWidth: tooltip.borderWidth
      },
      title: {
        display: true,
        text: config.title,
        color: '#333',
        font: {
          size: 16,
          weight: 'bold'
        }
      }
    },
    scales: {
      x: {
        display: xAxis.display,
        title: xAxis.title,
        grid: xAxis.grid,
        ticks: xAxis.ticks
      },
      y: {
        display: yAxis.display,
        title: yAxis.title,
        grid: yAxis.grid,
        ticks: yAxis.ticks
      }
    },
    interaction: {
      intersect: false,
      mode: 'index' as const
    }
  };
};

// Generate histogram data from raw values
export const generateHistogramData = (
  values: number[],
  bins: number = 10,
  label: string = 'Frequency'
): ChartData => {
  if (values.length === 0) {
    return {
      labels: [],
      datasets: [{
        label,
        data: [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  
  // Handle case where all values are the same
  if (min === max) {
    return {
      labels: [`${min.toFixed(1)}`],
      datasets: [{
        label,
        data: [values.length],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1
      }]
    };
  }
  
  const binWidth = (max - min) / bins;
  const binCounts = new Array(bins).fill(0);
  const binLabels = [];
  
  // Create bin labels
  for (let i = 0; i < bins; i++) {
    const binStart = min + i * binWidth;
    const binEnd = min + (i + 1) * binWidth;
    binLabels.push(`${binStart.toFixed(1)}-${binEnd.toFixed(1)}`);
  }
  
  // Count values in each bin
  values.forEach(value => {
    let binIndex = Math.floor((value - min) / binWidth);
    // Handle edge case where value equals max
    if (binIndex >= bins) {
      binIndex = bins - 1;
    }
    binCounts[binIndex]++;
  });
  
  return {
    labels: binLabels,
    datasets: [{
      label,
      data: binCounts,
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };
};

// Generate box plot data (simplified for Chart.js)
export const generateBoxPlotData = (
  values: number[],
  label: string = 'Box Plot'
): ChartData => {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const median = sorted[Math.floor(sorted.length * 0.5)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  
  return {
    labels: ['Min', 'Q1', 'Median', 'Q3', 'Max'],
    datasets: [{
      label,
      data: [min, q1, median, q3, max],
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 2
    }]
  };
};

// Export chart as image
export const exportChart = async (
  chartRef: any,
  options: ExportOptions
): Promise<string> => {
  if (!chartRef?.current) {
    throw new Error('Chart reference not available');
  }
  
  const canvas = chartRef.current.canvas;
  
  if (options.format === 'png') {
    return canvas.toDataURL('image/png', options.quality || 1.0);
  } else if (options.format === 'svg') {
    // For SVG export, we'd need additional libraries like canvas2svg
    throw new Error('SVG export not implemented yet');
  } else if (options.format === 'pdf') {
    // Use jsPDF for PDF export
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({
      orientation: options.width > options.height ? 'landscape' : 'portrait',
      unit: 'px',
      format: [options.width, options.height]
    });
    
    const imgData = canvas.toDataURL('image/png', options.quality || 1.0);
    pdf.addImage(imgData, 'PNG', 0, 0, options.width, options.height);
    
    return pdf.output('datauristring');
  }
  
  throw new Error(`Unsupported export format: ${options.format}`);
};

// Validate chart data
export const validateChartData = (data: ChartData): boolean => {
  if (!data.labels || !Array.isArray(data.labels)) {
    return false;
  }
  
  if (!data.datasets || !Array.isArray(data.datasets)) {
    return false;
  }
  
  return data.datasets.every(dataset => 
    dataset.data && 
    Array.isArray(dataset.data) && 
    dataset.data.length === data.labels.length
  );
};

// Generate responsive breakpoints for charts
export const getResponsiveOptions = (containerWidth: number) => {
  if (containerWidth < 576) {
    // Mobile
    return {
      maintainAspectRatio: false,
      aspectRatio: 1,
      plugins: {
        legend: {
          position: 'bottom' as const
        }
      }
    };
  } else if (containerWidth < 768) {
    // Tablet
    return {
      maintainAspectRatio: true,
      aspectRatio: 1.5,
      plugins: {
        legend: {
          position: 'top' as const
        }
      }
    };
  } else {
    // Desktop
    return {
      maintainAspectRatio: true,
      aspectRatio: 2,
      plugins: {
        legend: {
          position: 'top' as const
        }
      }
    };
  }
};