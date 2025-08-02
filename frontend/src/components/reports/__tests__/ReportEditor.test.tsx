import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ReportEditor from '../ReportEditor';
import { reportApi } from '../../../services/reportApi';

// Mock the report API
vi.mock('../../../services/reportApi', () => ({
  reportApi: {
    getReport: vi.fn(),
    createReport: vi.fn(),
    updateReport: vi.fn(),
    exportReport: vi.fn()
  },
  downloadReport: vi.fn()
}));

// Mock RichTextEditor
vi.mock('../RichTextEditor', () => ({
  default: ({ content, onChange, placeholder }: any) => (
    <div data-testid="rich-text-editor">
      <textarea
        value={content}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  )
}));

// Mock react-beautiful-dnd
vi.mock('react-beautiful-dnd', () => ({
  DragDropContext: ({ children }: any) => <div>{children}</div>,
  Droppable: ({ children }: any) => children({ droppableProps: {}, innerRef: vi.fn() }, {}),
  Draggable: ({ children }: any) => children(
    { draggableProps: {}, dragHandleProps: {}, innerRef: vi.fn() },
    {}
  )
}));

const mockReport = {
  id: 'report-1',
  title: 'Test Report',
  description: 'Test Description',
  projectId: 'project-1',
  userId: 'user-1',
  sections: [
    {
      id: 'section-1',
      type: 'text' as const,
      title: 'Introduction',
      content: 'This is the introduction',
      order: 0,
      formatting: {}
    }
  ],
  version: 1,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  isPublic: false,
  collaborators: []
};

describe('ReportEditor', () => {
  const mockOnSave = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state initially when reportId is provided', () => {
    vi.mocked(reportApi.getReport).mockImplementation(() => new Promise(() => {}));

    render(
      <ReportEditor
        reportId="report-1"
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('loads existing report when reportId is provided', async () => {
    vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);

    render(
      <ReportEditor
        reportId="report-1"
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Report')).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Description')).toBeInTheDocument();
    });

    expect(reportApi.getReport).toHaveBeenCalledWith('report-1');
  });

  it('creates new report when no reportId is provided', () => {
    render(
      <ReportEditor
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByDisplayValue('Untitled Report')).toBeInTheDocument();
    expect(screen.getByDisplayValue('')).toBeInTheDocument(); // description field
  });

  it('allows editing report title and description', async () => {
    render(
      <ReportEditor
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    const titleInput = screen.getByLabelText(/report title/i);
    const descriptionInput = screen.getByLabelText(/description/i);

    fireEvent.change(titleInput, { target: { value: 'New Report Title' } });
    fireEvent.change(descriptionInput, { target: { value: 'New Description' } });

    expect(titleInput).toHaveValue('New Report Title');
    expect(descriptionInput).toHaveValue('New Description');
  });

  it('displays existing sections', async () => {
    vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);

    render(
      <ReportEditor
        reportId="report-1"
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Introduction')).toBeInTheDocument();
      expect(screen.getByText('text')).toBeInTheDocument(); // section type chip
    });
  });

  it('allows adding new sections', async () => {
    render(
      <ReportEditor
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    const addTextButton = screen.getByRole('button', { name: /text/i });
    fireEvent.click(addTextButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('New text section')).toBeInTheDocument();
    });
  });

  it('allows deleting sections', async () => {
    vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);

    render(
      <ReportEditor
        reportId="report-1"
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      fireEvent.click(deleteButton);
    });

    await waitFor(() => {
      expect(screen.queryByDisplayValue('Introduction')).not.toBeInTheDocument();
    });
  });

  it('saves new report', async () => {
    const savedReport = { ...mockReport, id: 'new-report-1' };
    vi.mocked(reportApi.createReport).mockResolvedValue(savedReport);

    render(
      <ReportEditor
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    const titleInput = screen.getByLabelText(/report title/i);
    fireEvent.change(titleInput, { target: { value: 'New Report' } });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(reportApi.createReport).toHaveBeenCalledWith({
        title: 'New Report',
        description: '',
        projectId: 'project-1',
        sections: []
      });
      expect(mockOnSave).toHaveBeenCalledWith(savedReport);
    });
  });

  it('updates existing report', async () => {
    vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);
    const updatedReport = { ...mockReport, title: 'Updated Report', version: 2 };
    vi.mocked(reportApi.updateReport).mockResolvedValue(updatedReport);

    render(
      <ReportEditor
        reportId="report-1"
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      const titleInput = screen.getByDisplayValue('Test Report');
      fireEvent.change(titleInput, { target: { value: 'Updated Report' } });
    });

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(reportApi.updateReport).toHaveBeenCalledWith('report-1', {
        title: 'Updated Report',
        description: 'Test Description',
        sections: mockReport.sections
      });
      expect(mockOnSave).toHaveBeenCalledWith(updatedReport);
    });
  });

  it('shows saving state during save operation', async () => {
    vi.mocked(reportApi.createReport).mockImplementation(() => new Promise(() => {}));

    render(
      <ReportEditor
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  it('handles save errors', async () => {
    vi.mocked(reportApi.createReport).mockRejectedValue(new Error('Save failed'));

    render(
      <ReportEditor
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/failed to save report/i)).toBeInTheDocument();
    });
  });

  it('opens export dialog', async () => {
    vi.mocked(reportApi.getReport).mockResolvedValue(mockReport);

    render(
      <ReportEditor
        reportId="report-1"
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    await waitFor(() => {
      const menuButton = screen.getByRole('button', { name: /more/i });
      fireEvent.click(menuButton);
    });

    const exportMenuItem = screen.getByText(/export/i);
    fireEvent.click(exportMenuItem);

    await waitFor(() => {
      expect(screen.getByText(/export report/i)).toBeInTheDocument();
    });
  });

  it('handles different section types', async () => {
    render(
      <ReportEditor
        projectId="project-1"
        onSave={mockOnSave}
        onClose={mockOnClose}
      />
    );

    // Add different section types
    const addAnalysisButton = screen.getByRole('button', { name: /analysis/i });
    fireEvent.click(addAnalysisButton);

    const addChartButton = screen.getByRole('button', { name: /chart/i });
    fireEvent.click(addChartButton);

    const addTableButton = screen.getByRole('button', { name: /table/i });
    fireEvent.click(addTableButton);

    await waitFor(() => {
      expect(screen.getByDisplayValue('New analysis section')).toBeInTheDocument();
      expect(screen.getByDisplayValue('New visualization section')).toBeInTheDocument();
      expect(screen.getByDisplayValue('New table section')).toBeInTheDocument();
    });
  });
});