import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Menu,
  MenuItem,
  Divider,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add,
  Delete,
  DragHandle,
  Save,
  Share,
  Download,
  History,
  MoreVert
} from '@mui/icons-material';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import RichTextEditor from './RichTextEditor';
import { Report, ReportSection, ReportExportOptions } from '../../types/report';
import { reportApi, downloadReport } from '../../services/reportApi';

interface ReportEditorProps {
  reportId?: string;
  projectId: string;
  onSave?: (report: Report) => void;
  onClose?: () => void;
}

const ReportEditor: React.FC<ReportEditorProps> = ({
  reportId,
  projectId,
  onSave,
  onClose
}) => {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [versionsDialogOpen, setVersionsDialogOpen] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (reportId) {
      loadReport();
    } else {
      // Create new report
      setReport({
        id: '',
        title: 'Untitled Report',
        description: '',
        projectId,
        userId: '',
        sections: [],
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        isPublic: false,
        collaborators: []
      });
    }
  }, [reportId, projectId]);

  const loadReport = async () => {
    if (!reportId) return;
    
    setLoading(true);
    try {
      const loadedReport = await reportApi.getReport(reportId);
      setReport(loadedReport);
    } catch (err) {
      setError('Failed to load report');
      console.error('Error loading report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!report) return;

    setSaving(true);
    try {
      let savedReport: Report;
      if (reportId) {
        savedReport = await reportApi.updateReport(reportId, {
          title: report.title,
          description: report.description,
          sections: report.sections
        });
      } else {
        savedReport = await reportApi.createReport({
          title: report.title,
          description: report.description,
          projectId,
          sections: report.sections
        });
      }
      
      setReport(savedReport);
      onSave?.(savedReport);
    } catch (err) {
      setError('Failed to save report');
      console.error('Error saving report:', err);
    } finally {
      setSaving(false);
    }
  };

  const addSection = (type: ReportSection['type']) => {
    if (!report) return;

    const newSection: ReportSection = {
      id: `section-${Date.now()}`,
      type,
      title: `New ${type} section`,
      content: type === 'text' ? '' : {},
      order: report.sections.length,
      formatting: {}
    };

    setReport({
      ...report,
      sections: [...report.sections, newSection]
    });
  };

  const updateSection = (sectionId: string, updates: Partial<ReportSection>) => {
    if (!report) return;

    setReport({
      ...report,
      sections: report.sections.map(section =>
        section.id === sectionId ? { ...section, ...updates } : section
      )
    });
  };

  const deleteSection = (sectionId: string) => {
    if (!report) return;

    setReport({
      ...report,
      sections: report.sections.filter(section => section.id !== sectionId)
    });
  };

  const handleDragEnd = (result: any) => {
    if (!result.destination || !report) return;

    const items = Array.from(report.sections);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    // Update order values
    const updatedSections = items.map((section, index) => ({
      ...section,
      order: index
    }));

    setReport({
      ...report,
      sections: updatedSections
    });
  };

  const handleExport = async (options: ReportExportOptions) => {
    if (!reportId) return;

    try {
      const blob = await reportApi.exportReport(reportId, options);
      const filename = `${report?.title || 'report'}.${options.format}`;
      downloadReport(blob, filename);
      setExportDialogOpen(false);
    } catch (err) {
      setError('Failed to export report');
      console.error('Error exporting report:', err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (!report) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <Typography>Report not found</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box display="flex" justifyContent="between" alignItems="center" mb={2}>
          <Typography variant="h4" component="h1">
            Report Editor
          </Typography>
          <Box>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} /> : <Save />}
              onClick={handleSave}
              disabled={saving}
              sx={{ mr: 1 }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <MoreVert />
            </IconButton>
          </Box>
        </Box>

        <TextField
          fullWidth
          label="Report Title"
          value={report.title}
          onChange={(e) => setReport({ ...report, title: e.target.value })}
          sx={{ mb: 2 }}
        />

        <TextField
          fullWidth
          label="Description"
          multiline
          rows={2}
          value={report.description || ''}
          onChange={(e) => setReport({ ...report, description: e.target.value })}
        />
      </Paper>

      {/* Sections */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="sections">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef}>
              {report.sections.map((section, index) => (
                <Draggable key={section.id} draggableId={section.id} index={index}>
                  {(provided) => (
                    <Paper
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      sx={{ mb: 2, p: 3 }}
                    >
                      <Box display="flex" alignItems="center" mb={2}>
                        <div {...provided.dragHandleProps}>
                          <DragHandle sx={{ mr: 1, color: 'text.secondary' }} />
                        </div>
                        <Chip
                          label={section.type}
                          size="small"
                          sx={{ mr: 2 }}
                        />
                        <TextField
                          size="small"
                          value={section.title}
                          onChange={(e) => updateSection(section.id, { title: e.target.value })}
                          sx={{ flexGrow: 1, mr: 1 }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => deleteSection(section.id)}
                          color="error"
                        >
                          <Delete />
                        </IconButton>
                      </Box>

                      {section.type === 'text' && (
                        <RichTextEditor
                          content={section.content || ''}
                          onChange={(content) => updateSection(section.id, { content })}
                          placeholder="Enter your text content..."
                        />
                      )}

                      {section.type === 'analysis' && (
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Analysis results will be displayed here
                          </Typography>
                        </Box>
                      )}

                      {section.type === 'visualization' && (
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Chart visualization will be displayed here
                          </Typography>
                        </Box>
                      )}

                      {section.type === 'table' && (
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            Data table will be displayed here
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Add Section Button */}
      <Paper sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="h6" gutterBottom>
          Add Section
        </Typography>
        <Box display="flex" justifyContent="center" gap={1} flexWrap="wrap">
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => addSection('text')}
          >
            Text
          </Button>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => addSection('analysis')}
          >
            Analysis
          </Button>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => addSection('visualization')}
          >
            Chart
          </Button>
          <Button
            variant="outlined"
            startIcon={<Add />}
            onClick={() => addSection('table')}
          >
            Table
          </Button>
        </Box>
      </Paper>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => { setExportDialogOpen(true); setMenuAnchor(null); }}>
          <Download sx={{ mr: 1 }} />
          Export
        </MenuItem>
        <MenuItem onClick={() => { setShareDialogOpen(true); setMenuAnchor(null); }}>
          <Share sx={{ mr: 1 }} />
          Share
        </MenuItem>
        <MenuItem onClick={() => { setVersionsDialogOpen(true); setMenuAnchor(null); }}>
          <History sx={{ mr: 1 }} />
          Version History
        </MenuItem>
      </Menu>

      {/* Export Dialog */}
      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
      />
    </Box>
  );
};

// Export Dialog Component
interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  onExport: (options: ReportExportOptions) => void;
}

const ExportDialog: React.FC<ExportDialogProps> = ({ open, onClose, onExport }) => {
  const [format, setFormat] = useState<'pdf' | 'docx' | 'html'>('pdf');
  const [includeCharts, setIncludeCharts] = useState(true);
  const [includeRawData, setIncludeRawData] = useState(false);
  const [applyAPAFormatting, setApplyAPAFormatting] = useState(true);

  const handleExport = () => {
    onExport({
      format,
      includeCharts,
      includeRawData,
      applyAPAFormatting
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Export Report</DialogTitle>
      <DialogContent>
        <Box sx={{ pt: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Format
          </Typography>
          <Box display="flex" gap={1} mb={3}>
            {(['pdf', 'docx', 'html'] as const).map((fmt) => (
              <Button
                key={fmt}
                variant={format === fmt ? 'contained' : 'outlined'}
                onClick={() => setFormat(fmt)}
              >
                {fmt.toUpperCase()}
              </Button>
            ))}
          </Box>

          <Typography variant="subtitle2" gutterBottom>
            Options
          </Typography>
          <List dense>
            <ListItem>
              <ListItemText primary="Include Charts" />
              <ListItemSecondaryAction>
                <Button
                  size="small"
                  variant={includeCharts ? 'contained' : 'outlined'}
                  onClick={() => setIncludeCharts(!includeCharts)}
                >
                  {includeCharts ? 'Yes' : 'No'}
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
            <ListItem>
              <ListItemText primary="Include Raw Data" />
              <ListItemSecondaryAction>
                <Button
                  size="small"
                  variant={includeRawData ? 'contained' : 'outlined'}
                  onClick={() => setIncludeRawData(!includeRawData)}
                >
                  {includeRawData ? 'Yes' : 'No'}
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
            <ListItem>
              <ListItemText primary="Apply APA Formatting" />
              <ListItemSecondaryAction>
                <Button
                  size="small"
                  variant={applyAPAFormatting ? 'contained' : 'outlined'}
                  onClick={() => setApplyAPAFormatting(!applyAPAFormatting)}
                >
                  {applyAPAFormatting ? 'Yes' : 'No'}
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          </List>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleExport}>
          Export
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportEditor;