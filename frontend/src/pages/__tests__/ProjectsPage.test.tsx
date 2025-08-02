import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { ProjectsPage } from '../ProjectsPage';
import { collaborationApi } from '../../services/collaborationApi';
import type { Project } from '../../types/collaboration';

// Mock the collaboration API
vi.mock('../../services/collaborationApi', () => ({
  collaborationApi: {
    getProjects: vi.fn(),
    createProject: vi.fn(),
    archiveProject: vi.fn()
  }
}));

// Mock the router
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate
  };
});

const mockProjects: Project[] = [
  {
    id: '1',
    name: 'Test Project 1',
    description: 'First test project',
    ownerId: 'user1',
    isArchived: false,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    owner: {
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com'
    },
    collaborators: [
      {
        id: 'collab1',
        userId: 'user2',
        projectId: '1',
        role: 'EDITOR',
        joinedAt: '2024-01-01T00:00:00Z',
        user: {
          id: 'user2',
          name: 'Collaborator',
          email: 'collab@example.com'
        }
      }
    ],
    _count: {
      datasets: 5,
      analyses: 3,
      reports: 2
    }
  },
  {
    id: '2',
    name: 'Archived Project',
    description: 'This project is archived',
    ownerId: 'user1',
    isArchived: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    owner: {
      id: 'user1',
      name: 'Test User',
      email: 'test@example.com'
    },
    collaborators: [],
    _count: {
      datasets: 1,
      analyses: 0,
      reports: 1
    }
  }
];

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

describe('ProjectsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (collaborationApi.getProjects as any).mockResolvedValue(mockProjects);
  });

  it('should render projects list', async () => {
    renderWithRouter(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Test Project 1')).toBeInTheDocument();
      expect(screen.getByText('Archived Project')).toBeInTheDocument();
    });

    expect(screen.getByText('First test project')).toBeInTheDocument();
    expect(screen.getByText('5 datasets')).toBeInTheDocument();
    expect(screen.getByText('3 analyses')).toBeInTheDocument();
    expect(screen.getByText('2 reports')).toBeInTheDocument();
  });

  it('should show archived status', async () => {
    renderWithRouter(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Archived')).toBeInTheDocument();
    });
  });

  it('should open create project dialog', async () => {
    renderWithRouter(<ProjectsPage />);

    const newProjectButton = screen.getByText('New Project');
    fireEvent.click(newProjectButton);

    expect(screen.getByText('Create New Project')).toBeInTheDocument();
    expect(screen.getByLabelText('Project Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Description (optional)')).toBeInTheDocument();
  });

  it('should create new project', async () => {
    const newProject = {
      id: '3',
      name: 'New Project',
      description: 'A new project',
      ownerId: 'user1',
      isArchived: false,
      createdAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z',
      owner: {
        id: 'user1',
        name: 'Test User',
        email: 'test@example.com'
      },
      collaborators: [],
      _count: {
        datasets: 0,
        analyses: 0,
        reports: 0
      }
    };

    (collaborationApi.createProject as any).mockResolvedValue(newProject);

    renderWithRouter(<ProjectsPage />);

    // Open dialog
    const newProjectButton = screen.getByText('New Project');
    fireEvent.click(newProjectButton);

    // Fill form
    const nameInput = screen.getByLabelText('Project Name');
    const descriptionInput = screen.getByLabelText('Description (optional)');
    
    fireEvent.change(nameInput, { target: { value: 'New Project' } });
    fireEvent.change(descriptionInput, { target: { value: 'A new project' } });

    // Submit
    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(collaborationApi.createProject).toHaveBeenCalledWith({
        name: 'New Project',
        description: 'A new project'
      });
    });
  });

  it('should navigate to project detail', async () => {
    renderWithRouter(<ProjectsPage />);

    await waitFor(() => {
      const openButton = screen.getAllByText('Open')[0];
      fireEvent.click(openButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/projects/1');
  });

  it('should navigate to collaborators page', async () => {
    renderWithRouter(<ProjectsPage />);

    await waitFor(() => {
      const membersButton = screen.getByText('2 members');
      fireEvent.click(membersButton);
    });

    expect(mockNavigate).toHaveBeenCalledWith('/projects/1/collaborators');
  });

  it('should handle API errors', async () => {
    (collaborationApi.getProjects as any).mockRejectedValue(new Error('API Error'));

    renderWithRouter(<ProjectsPage />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load projects')).toBeInTheDocument();
    });
  });

  it('should validate project name when creating', async () => {
    renderWithRouter(<ProjectsPage />);

    // Open dialog
    const newProjectButton = screen.getByText('New Project');
    fireEvent.click(newProjectButton);

    // Try to create without name
    const createButton = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Project name is required')).toBeInTheDocument();
    });

    expect(collaborationApi.createProject).not.toHaveBeenCalled();
  });

  it('should disable open button for archived projects', async () => {
    renderWithRouter(<ProjectsPage />);

    await waitFor(() => {
      const openButtons = screen.getAllByText('Open');
      // The archived project's open button should be disabled
      expect(openButtons[1]).toBeDisabled();
    });
  });
});