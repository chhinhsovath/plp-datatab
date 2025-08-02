import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardActions,
  Chip,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  Fab
} from '@mui/material';
import {
  Add as AddIcon,
  MoreVert as MoreVertIcon,
  People as PeopleIcon,
  Dataset as DatasetIcon,
  Analytics as AnalyticsIcon,
  Description as ReportIcon,
  Archive as ArchiveIcon,
  Unarchive as UnarchiveIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { collaborationApi } from '../services/collaborationApi';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import type { Project, CreateProjectRequest } from '../types/collaboration';
import { getRoleDisplayName, getRoleColor, canArchiveProject } from '../types/collaboration';

export const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState<CreateProjectRequest>({ name: '', description: '' });
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const data = await collaborationApi.getProjects();
      setProjects(data);
    } catch (err) {
      setError('Failed to load projects');
      console.error('Load projects error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = async () => {
    try {
      if (!newProject.name.trim()) {
        setError('Project name is required');
        return;
      }

      const project = await collaborationApi.createProject(newProject);
      setProjects(prev => [project, ...prev]);
      setCreateDialogOpen(false);
      setNewProject({ name: '', description: '' });
      setError(null);
    } catch (err) {
      setError('Failed to create project');
      console.error('Create project error:', err);
    }
  };

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, project: Project) => {
    setMenuAnchor(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedProject(null);
  };

  const handleArchiveProject = async (isArchived: boolean) => {
    if (!selectedProject) return;

    try {
      await collaborationApi.archiveProject(selectedProject.id, { isArchived });
      setProjects(prev => prev.map(p => 
        p.id === selectedProject.id ? { ...p, isArchived } : p
      ));
      handleMenuClose();
    } catch (err) {
      setError(`Failed to ${isArchived ? 'archive' : 'unarchive'} project`);
      console.error('Archive project error:', err);
    }
  };

  const getUserRole = (project: Project) => {
    // This would need to be enhanced to get the actual user role
    return 'OWNER'; // Placeholder
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          New Project
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {projects.map((project) => (
          <Grid item xs={12} sm={6} md={4} key={project.id}>
            <Card 
              sx={{ 
                height: '100%', 
                display: 'flex', 
                flexDirection: 'column',
                opacity: project.isArchived ? 0.7 : 1
              }}
            >
              <CardContent sx={{ flexGrow: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Typography variant="h6" component="h2" noWrap>
                    {project.name}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, project)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>

                {project.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {project.description}
                  </Typography>
                )}

                <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                  <Chip
                    label={getRoleDisplayName(getUserRole(project))}
                    color={getRoleColor(getUserRole(project)) as any}
                    size="small"
                  />
                  {project.isArchived && (
                    <Chip
                      label="Archived"
                      color="default"
                      size="small"
                      icon={<ArchiveIcon />}
                    />
                  )}
                </Box>

                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <DatasetIcon fontSize="small" color="action" />
                    <Typography variant="caption">
                      {project._count.datasets} datasets
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <AnalyticsIcon fontSize="small" color="action" />
                    <Typography variant="caption">
                      {project._count.analyses} analyses
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ReportIcon fontSize="small" color="action" />
                    <Typography variant="caption">
                      {project._count.reports} reports
                    </Typography>
                  </Box>
                </Box>
              </CardContent>

              <CardActions>
                <Button
                  size="small"
                  onClick={() => navigate(`/projects/${project.id}`)}
                  disabled={project.isArchived}
                >
                  Open
                </Button>
                <Button
                  size="small"
                  startIcon={<PeopleIcon />}
                  onClick={() => navigate(`/projects/${project.id}/collaborators`)}
                >
                  {project.collaborators.length + 1} members
                </Button>
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
      >
        {selectedProject && canArchiveProject(getUserRole(selectedProject)) && (
          <MenuItem
            onClick={() => handleArchiveProject(!selectedProject.isArchived)}
          >
            {selectedProject.isArchived ? (
              <>
                <UnarchiveIcon sx={{ mr: 1 }} />
                Unarchive
              </>
            ) : (
              <>
                <ArchiveIcon sx={{ mr: 1 }} />
                Archive
              </>
            )}
          </MenuItem>
        )}
      </Menu>

      {/* Create Project Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Project Name"
            fullWidth
            variant="outlined"
            value={newProject.name}
            onChange={(e) => setNewProject(prev => ({ ...prev, name: e.target.value }))}
            sx={{ mb: 2 }}
          />
          <TextField
            margin="dense"
            label="Description (optional)"
            fullWidth
            multiline
            rows={3}
            variant="outlined"
            value={newProject.description}
            onChange={(e) => setNewProject(prev => ({ ...prev, description: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateProject} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ProjectsPage;