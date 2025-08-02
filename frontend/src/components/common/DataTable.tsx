import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  TextField,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  TableSortLabel,
  Switch,
  FormControlLabel,
  CircularProgress,
} from '@mui/material';
import {
  Search,
  FilterList,
  GetApp,
  Visibility,
  Speed,
} from '@mui/icons-material';
import { DataRow, ColumnInfo } from '../../types/data';

interface DataTableProps {
  data: DataRow[];
  columns: ColumnInfo[];
  title?: string;
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  exportable?: boolean;
  selectable?: boolean;
  onRowSelect?: (selectedRows: DataRow[]) => void;
  onExport?: () => void;
  maxHeight?: number;
  pageSize?: number;
  virtualScrolling?: boolean;
  loading?: boolean;
  onLoadMore?: () => void;
  hasMore?: boolean;
}

interface VirtualScrollConfig {
  itemHeight: number;
  containerHeight: number;
  overscan: number;
}

type SortDirection = 'asc' | 'desc';

interface SortConfig {
  column: string;
  direction: SortDirection;
}

const DataTable: React.FC<DataTableProps> = ({
  data,
  columns,
  title,
  searchable = true,
  sortable = true,
  filterable = false,
  exportable = false,
  selectable = false,
  onRowSelect,
  onExport,
  maxHeight = 600,
  pageSize = 25,
  virtualScrolling = false,
  loading = false,
  onLoadMore,
  hasMore = false,
}) => {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(pageSize);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [useVirtualScrolling, setUseVirtualScrolling] = useState(virtualScrolling);
  const [scrollTop, setScrollTop] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const VIRTUAL_SCROLL_THRESHOLD = 1000; // Enable virtual scrolling for datasets > 1000 rows
  
  // Virtual scrolling configuration
  const virtualConfig: VirtualScrollConfig = {
    itemHeight: 53, // Approximate height of a table row
    containerHeight: maxHeight,
    overscan: 5, // Render 5 extra items above and below visible area
  };

  // Filter and search data
  const filteredData = useMemo(() => {
    let filtered = data;

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(row =>
        Object.values(row).some(value =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (sortConfig) {
      filtered = [...filtered].sort((a, b) => {
        const aValue = a[sortConfig.column];
        const bValue = b[sortConfig.column];

        if (aValue === null || aValue === undefined) return 1;
        if (bValue === null || bValue === undefined) return -1;

        if (typeof aValue === 'number' && typeof bValue === 'number') {
          return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
        }

        const aStr = String(aValue).toLowerCase();
        const bStr = String(bValue).toLowerCase();

        if (aStr < bStr) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aStr > bStr) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [data, searchTerm, sortConfig]);

  // Virtual scrolling calculations
  const virtualScrollData = useMemo(() => {
    if (!useVirtualScrolling || filteredData.length <= VIRTUAL_SCROLL_THRESHOLD) {
      return null;
    }

    const startIndex = Math.floor(scrollTop / virtualConfig.itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(virtualConfig.containerHeight / virtualConfig.itemHeight) + virtualConfig.overscan,
      filteredData.length
    );
    const visibleStartIndex = Math.max(0, startIndex - virtualConfig.overscan);

    return {
      totalHeight: filteredData.length * virtualConfig.itemHeight,
      visibleData: filteredData.slice(visibleStartIndex, endIndex),
      visibleStartIndex,
      offsetY: visibleStartIndex * virtualConfig.itemHeight,
    };
  }, [filteredData, scrollTop, useVirtualScrolling, virtualConfig]);

  // Paginated data (for non-virtual scrolling)
  const paginatedData = useMemo(() => {
    if (useVirtualScrolling && filteredData.length > VIRTUAL_SCROLL_THRESHOLD) {
      return filteredData; // Return all data for virtual scrolling
    }
    const startIndex = page * rowsPerPage;
    return filteredData.slice(startIndex, startIndex + rowsPerPage);
  }, [filteredData, page, rowsPerPage, useVirtualScrolling]);

  // Handle scroll for virtual scrolling
  const handleScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    if (useVirtualScrolling && filteredData.length > VIRTUAL_SCROLL_THRESHOLD) {
      setScrollTop(event.currentTarget.scrollTop);
      
      // Load more data if near bottom and hasMore is true
      if (onLoadMore && hasMore) {
        const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
        if (scrollHeight - scrollTop <= clientHeight * 1.5) {
          onLoadMore();
        }
      }
    }
  }, [useVirtualScrolling, filteredData.length, onLoadMore, hasMore]);

  // Auto-enable virtual scrolling for large datasets
  useEffect(() => {
    if (filteredData.length > VIRTUAL_SCROLL_THRESHOLD && !virtualScrolling) {
      setUseVirtualScrolling(true);
    }
  }, [filteredData.length, virtualScrolling]);

  const handleSort = (columnName: string) => {
    if (!sortable) return;

    setSortConfig(prevConfig => {
      if (prevConfig?.column === columnName) {
        if (prevConfig.direction === 'asc') {
          return { column: columnName, direction: 'desc' };
        } else {
          return null; // Remove sorting
        }
      } else {
        return { column: columnName, direction: 'asc' };
      }
    });
  };

  const handleRowSelect = (index: number) => {
    if (!selectable) return;

    const newSelectedRows = new Set(selectedRows);
    if (newSelectedRows.has(index)) {
      newSelectedRows.delete(index);
    } else {
      newSelectedRows.add(index);
    }
    
    setSelectedRows(newSelectedRows);
    
    if (onRowSelect) {
      const selectedData = Array.from(newSelectedRows).map(i => filteredData[i]);
      onRowSelect(selectedData);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const formatCellValue = (value: any, column: ColumnInfo) => {
    if (value === null || value === undefined) {
      return <Chip label="NULL" size="small" color="default" />;
    }

    if (column.dataType === 'numeric' && typeof value === 'number') {
      return value.toLocaleString();
    }

    if (column.dataType === 'date') {
      try {
        return new Date(value).toLocaleDateString();
      } catch {
        return String(value);
      }
    }

    return String(value);
  };

  const getColumnTypeColor = (dataType: ColumnInfo['dataType']) => {
    switch (dataType) {
      case 'numeric':
        return 'primary';
      case 'categorical':
        return 'secondary';
      case 'date':
        return 'success';
      case 'text':
        return 'default';
      default:
        return 'default';
    }
  };

  return (
    <Paper sx={{ width: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          {title && (
            <Typography variant="h6" component="h2">
              {title}
            </Typography>
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            {filterable && (
              <Tooltip title="Filter">
                <IconButton>
                  <FilterList />
                </IconButton>
              </Tooltip>
            )}
            {exportable && (
              <Tooltip title="Export">
                <IconButton onClick={onExport}>
                  <GetApp />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {searchable && (
            <TextField
              fullWidth
              size="small"
              placeholder="Search data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} />,
              }}
            />
          )}
          
          {filteredData.length > VIRTUAL_SCROLL_THRESHOLD && (
            <FormControlLabel
              control={
                <Switch
                  checked={useVirtualScrolling}
                  onChange={(e) => setUseVirtualScrolling(e.target.checked)}
                  icon={<Speed />}
                  checkedIcon={<Speed />}
                />
              }
              label="Virtual Scrolling"
            />
          )}
        </Box>

        <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          {columns.map((column) => (
            <Chip
              key={column.name}
              label={`${column.name} (${column.dataType})`}
              size="small"
              color={getColumnTypeColor(column.dataType) as any}
              variant="outlined"
            />
          ))}
          
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
            {filteredData.length.toLocaleString()} rows
            {useVirtualScrolling && filteredData.length > VIRTUAL_SCROLL_THRESHOLD && (
              <Chip 
                label="Virtual Scrolling" 
                size="small" 
                color="primary" 
                variant="outlined" 
                sx={{ ml: 1 }}
              />
            )}
          </Typography>
        </Box>
      </Box>

      {/* Table */}
      <TableContainer 
        ref={containerRef}
        sx={{ maxHeight }}
        onScroll={handleScroll}
      >
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {selectable && (
                <TableCell padding="checkbox">
                  <Visibility />
                </TableCell>
              )}
              {columns.map((column) => (
                <TableCell key={column.name}>
                  {sortable ? (
                    <TableSortLabel
                      active={sortConfig?.column === column.name}
                      direction={sortConfig?.column === column.name ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort(column.name)}
                    >
                      {column.name}
                    </TableSortLabel>
                  ) : (
                    column.name
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {/* Virtual scrolling spacer */}
            {virtualScrollData && (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  sx={{ 
                    height: virtualScrollData.offsetY,
                    padding: 0,
                    border: 'none'
                  }}
                />
              </TableRow>
            )}
            
            {/* Render visible rows */}
            {(virtualScrollData ? virtualScrollData.visibleData : paginatedData).map((row, index) => {
              const actualIndex = virtualScrollData 
                ? virtualScrollData.visibleStartIndex + index
                : page * rowsPerPage + index;
                
              return (
                <TableRow
                  key={actualIndex}
                  hover
                  selected={selectedRows.has(actualIndex)}
                  onClick={() => handleRowSelect(actualIndex)}
                  sx={{ 
                    cursor: selectable ? 'pointer' : 'default',
                    height: virtualScrollData ? virtualConfig.itemHeight : 'auto'
                  }}
                >
                  {selectable && (
                    <TableCell padding="checkbox">
                      {selectedRows.has(actualIndex) && <Visibility />}
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell key={column.name}>
                      {formatCellValue(row[column.name], column)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
            
            {/* Virtual scrolling bottom spacer */}
            {virtualScrollData && (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  sx={{ 
                    height: Math.max(0, virtualScrollData.totalHeight - virtualScrollData.offsetY - (virtualScrollData.visibleData.length * virtualConfig.itemHeight)),
                    padding: 0,
                    border: 'none'
                  }}
                />
              </TableRow>
            )}
            
            {/* Loading indicator */}
            {loading && (
              <TableRow>
                <TableCell 
                  colSpan={columns.length + (selectable ? 1 : 0)}
                  sx={{ textAlign: 'center', py: 2 }}
                >
                  <CircularProgress size={24} />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Loading more data...
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination - only show if not using virtual scrolling */}
      {(!useVirtualScrolling || filteredData.length <= VIRTUAL_SCROLL_THRESHOLD) && (
        <TablePagination
          rowsPerPageOptions={[10, 25, 50, 100]}
          component="div"
          count={filteredData.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}
      
      {/* Virtual scrolling info */}
      {useVirtualScrolling && filteredData.length > VIRTUAL_SCROLL_THRESHOLD && (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary">
            Showing {filteredData.length.toLocaleString()} rows with virtual scrolling
            {hasMore && (
              <span> • Scroll down to load more</span>
            )}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

export default DataTable;