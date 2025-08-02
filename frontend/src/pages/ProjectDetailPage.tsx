import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Alert
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  People as PeopleIcon,
  Dataset as DatasetIcon,
  Analytics as AnalyticsIcon,
  Description as ReportIcon,
  Timeline as ActivityIcon
} from '@mui/icons-material';
import { collaborationApi } from '../services/collaborationApi';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useSocket } from '../hooks/useSocket';
import type { Project, Activity, Comment } from '../types/collaboration';
import { getRoleDisplayName, getRoleColor } from '../types/collaboration';i
nterface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

const TabPanel: React.FC<TabPanelProps> = ({ children, value, index }) => (
  <div hidden={value !== index}>
    {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
  </div>
);

export const ProjectDetailPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const socket = useSocket();
  
  const [project, setProject] = useState<Project | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!projectId) return;

    loadProjectData();
    
    // Join project room for real-time updates
    socket.joinProject(projectId);

    // Set up real-time event listeners
    socket.on('activity-updated', handleActivityUpdate);
    socket.on('comment-created', handleCommentCreated);
    socket.on('project-updated', handleProjectUpdate);
    socket.on('collaborator-added', handleCollaboratorAdded);
    socket.on('collaborator-updated', handleCollaboratorUpdated);
    socket.on('collaborator-removed', handleCollaboratorRemoved);

    return () => {
      socket.leaveProject(projectId);
      socket.off('activity-updated');
      socket.off('comment-created');
      socket.off('project-updated');
      socket.off('collaborator-added');
      socket.off('collaborator-updated');
      socket.off('collaborator-removed');
    };
  }, [projectId]);

  const loadProjectData = async () => {
    if (!projectId) return;

    try {
      setLoading(true);
      const [projectData, activitiesData, commentsData] = await Promise.all([
        collaborationApi.getProject(projectId),
        collaborationApi.getProjectActivities(projectId),
        collaborationApi.getProjectComments(projectId)
      ]);

      setProject(projectData);
      setActivities(activitiesData);
      setComments(commentsData);
    } catch (err) {
      setError('Failed to load project data');
      console.error('Load project error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleActivityUpdate = (data: { activity: any; user: any; timestamp: string }) => {
    setActivities(prev => [data.activity, ...prev]);
  };

  const handleCommentCreated = (comment: Comment) => {
    setComments(prev => [comment, ...prev]);
  };

  const handleProjectUpdate = (data: { project: Project; user: any; timestamp: string }) => {
    setProject(data.project);
  };

  const handleCollaboratorAdded = (data: any) => {
    if (project) {
      setProject(prev => prev ? {
        ...prev,
        collaborators: [...prev.collaborators, data.collaborator]
      } : null);
    }
  };

  const handleCollaboratorUpdated = (data: any) => {
    if (project) {
      setProject(prev => prev ? {
        ...prev,
        collaborators: prev.collaborators.map(c => 
          c.id === data.collaborator.id ? data.collaborator : c
        )
      } : null);
    }
  };

  const handleCollaboratorRemoved = (data: { userId: string }) => {
    if (project) {
      setProject(prev => prev ? {
        ...prev,
        collaborators: prev.collaborators.filter(c => c.userId !== data.userId)
      } : null);
    }
  };

  const formatActivityDetails = (activity: Activity) => {
    switch (activity.type) {
      case 'PROJECT_CREATED':
        return `Created project "${activity.details.projectName}"`;
      case 'PROJECT_UPDATED':
        return 'Updated project details';
      case 'DATASET_UPLOADED':
        return 'Uploaded a new dataset';
      case 'ANALYSIS_CREATED':
        return 'Started a new analysis';
      case 'ANALYSIS_COMPLETED':
        return 'Completed an analysis';
      case 'REPORT_GENERATED':
        return 'Generated a new report';
      case 'USER_INVITED':
        return `Invited ${activity.details.invitedUser} as ${activity.details.role}`;
      case 'COMMENT_ADDED':
        return activity.details.isReply ? 'Replied to a comment' : 'Added a comment';
      default:
        return 'Unknown activity';
    }
  };

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!project) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">Project not found</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/projects')}
          sx={{ mr: 2 }}
        >
          Back to Projects
        </Button>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="h4" component="h1">
            {project.name}
          </Typography>
          {project.description && (
            <Typography variant="body1" color="text.secondary">
              {project.description}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Chip
            label={`${project.collaborators.length + 1} members`}
            icon={<PeopleIcon />}
            onClick={() => navigate(`/projects/${project.id}/collaborators`)}
            clickable
          />
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Connected Users */}
      {socket.connectedUsers.length > 0 && (
        <Paper sx={{ p: 2, mb: 3 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Currently online ({socket.connectedUsers.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {socket.connectedUsers.map(user => (
              <Chip
                key={user.id}
                label={user.name}
                size="small"
                avatar={<Avatar sx={{ width: 24, height: 24 }}>{user.name[0]}</Avatar>}
                color="success"
              />
            ))}
          </Box>
        </Paper>
      )}

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs value={activeTab} onChange={(_, newValue) => setActiveTab(newValue)}>
          <Tab label="Overview" />
          <Tab label="Activity" />
          <Tab label="Comments" />
        </Tabs>

        <TabPanel value={activeTab} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <DatasetIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Datasets</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {project._count.datasets}
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }}>
                    View All
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <AnalyticsIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Analyses</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {project._count.analyses}
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }}>
                    View All
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={4}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <ReportIcon sx={{ mr: 1 }} />
                    <Typography variant="h6">Reports</Typography>
                  </Box>
                  <Typography variant="h4" color="primary">
                    {project._count.reports}
                  </Typography>
                  <Button size="small" sx={{ mt: 1 }}>
                    View All
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <List>
            {activities.map((activity) => (
              <ListItem key={activity.id}>
                <ListItemAvatar>
                  <Avatar>
                    <ActivityIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={formatActivityDetails(activity)}
                  secondary={`${activity.user.name} • ${new Date(activity.createdAt).toLocaleString()}`}
                />
              </ListItem>
            ))}
            {activities.length === 0 && (
              <ListItem>
                <ListItemText primary="No activities yet" />
              </ListItem>
            )}
          </List>
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <List>
            {comments.map((comment) => (
              <ListItem key={comment.id} alignItems="flex-start">
                <ListItemAvatar>
                  <Avatar>{comment.user.name[0]}</Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={comment.user.name}
                  secondary={
                    <>
                      <Typography component="span" variant="body2">
                        {comment.content}
                      </Typography>
                      <br />
                      <Typography component="span" variant="caption" color="text.secondary">
                        {new Date(comment.createdAt).toLocaleString()}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
            {comments.length === 0 && (
              <ListItem>
                <ListItemText primary="No comments yet" />
              </ListItem>
            )}
          </List>
        </TabPanel>
      </Paper>
    </Box>
  );
};

export default ProjectDetailPage;