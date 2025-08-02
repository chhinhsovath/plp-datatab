import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Alert,
  CircularProgress
} from '@mui/material';
import {
  Add,
  MoreVert,
  Edit,
  Delete,
  Share,
  Download,
  Visibility
} from '@mui/icons-material';
import { useNavigate, useParams } from 'react-router-dom';
import { Report } from '../types/report';
import { reportApi, downloadReport } from '../services/reportApi';
import ReportEditor from '../components/reports/ReportEditor';

const ReportsPage: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingReportId, setEditingReportId] = useState<string | null>(null);

  useEffect(() => {
    if (projectId) {
      loadReports();
    }
  }, [projectId]);

  const loadReports = async () => {
    if (!projectId) return;

    setLoading(true);
    try {
      const projectReports = await reportApi.getProjectReports(projectId);
      setReports(projectReports);
    } catch (err) {
      setError('Failed to load reports');
      console.error('Error loading reports:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateReport = () => {
    setEditingReportId(null);
    setEditorOpen(true);
  };

  const handleEditReport = (report: Report) => {
    setEditingReportId(report.id);
    setEditorOpen(true);
    setMenuAnchor(null);
  };

  const handleDeleteReport = async (reportId: string) => {
    try {
      await reportApi.deleteReport(reportId);
      setReports(reports.filter(r => r.id !== reportId));
      setMenuAnchor(null);
    } catch (err) {
      setError('Failed to delete report');
      console.error('Error deleting report:', err);
    }
  };

  const handleExportReport = async (report: Report, format: 'pdf' | 'docx' | 'html') => {
    try {
      const blob = await reportApi.exportReport(report.id, {
        format,
        includeCharts: true,
        includeRawData: false,
        applyAPAFormatting: true
      });
      downloadReport(blob, `${report.title}.${format}`);
      setMenuAnchor(null);
    } catch (err) {
      setError('Failed to export report');
      console.error('Error exporting report:', err);
    }
  };

  const handleReportSaved = (report: Report) => {
    if (editingReportId) {
      setReports(reports.map(r => r.id === report.id ? report : r));
    } else {
      setReports([...reports, report]);
    }
    setEditorOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusColor = (report: Report) => {
    if (report.collaborators.length > 0) return 'success';
    if (report.isPublic) return 'info';
    return 'default';
  };

  const getStatusLabel = (report: Report) => {
    if (report.collaborators.length > 0) return 'Collaborative';
    if (report.isPublic) return 'Public';
    return 'Private';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
        <CircularProgress />
      </Box>
    );
  }

  if (editorOpen) {
    return (
      <ReportEditor
        reportId={editingReportId || undefined}
        projectId={projectId!}
        onSave={handleReportSaved}
        onClose={() => setEditorOpen(false)}
      />
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="between" alignItems="center" mb={3}>
        <Typography variant="h4" component="h1">
          Reports
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={handleCreateReport}
        >
          Create Report
        </Button>
      </Box>

      {reports.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary" gutterBottom>
            No reports yet
          </Typography>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Create your first report to document your analysis results
          </Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={handleCreateReport}
          >
            Create Report
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Updated</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">
                        {report.title}
                      </Typography>
                      {report.description && (
                        <Typography variant="body2" color="text.secondary">
                          {report.description}
                        </Typography>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(report)}
                      color={getStatusColor(report)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>v{report.version}</TableCell>
                  <TableCell>{formatDate(report.createdAt)}</TableCell>
                  <TableCell>{formatDate(report.updatedAt)}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      onClick={(e) => {
                        setSelectedReport(report);
                        setMenuAnchor(e.currentTarget);
                      }}
                    >
                      <MoreVert />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem onClick={() => selectedReport && handleEditReport(selectedReport)}>
          <Edit sx={{ mr: 1 }} />
          Edit
        </MenuItem>
        <MenuItem onClick={() => selectedReport && navigate(`/reports/${selectedReport.id}`)}>
          <Visibility sx={{ mr: 1 }} />
          View
        </MenuItem>
        <MenuItem onClick={() => selectedReport && handleExportReport(selectedReport, 'pdf')}>
          <Download sx={{ mr: 1 }} />
          Export PDF
        </MenuItem>
        <MenuItem onClick={() => selectedReport && handleExportReport(selectedReport, 'docx')}>
          <Download sx={{ mr: 1 }} />
          Export Word
        </MenuItem>
        <MenuItem onClick={() => selectedReport && handleExportReport(selectedReport, 'html')}>
          <Download sx={{ mr: 1 }} />
          Export HTML
        </MenuItem>
        <MenuItem>
          <Share sx={{ mr: 1 }} />
          Share
        </MenuItem>
        <MenuItem
          onClick={() => selectedReport && handleDeleteReport(selectedReport.id)}
          sx={{ color: 'error.main' }}
        >
          <Delete sx={{ mr: 1 }} />
          Delete
        </MenuItem>
      </Menu>

      {/* Create Report Dialog */}
      <CreateReportDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onConfirm={(title, description) => {
          // This would create a new report
          setCreateDialogOpen(false);
          handleCreateReport();
        }}
      />
    </Box>
  );
};

// Create Report Dialog Component
interface CreateReportDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (title: string, description: string) => void;
}

const CreateReportDialog: React.FC<CreateReportDialogProps> = ({
  open,
  onClose,
  onConfirm
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const handleConfirm = () => {
    if (title.trim()) {
      onConfirm(title, description);
      setTitle('');
      setDescription('');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create New Report</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Report Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mb: 2, mt: 1 }}
        />
        <TextField
          fullWidth
          label="Description (optional)"
          multiline
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={!title.trim()}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportsPage;