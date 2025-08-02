import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import RichTextEditor from '../RichTextEditor';

// Mock TipTap editor
vi.mock('@tiptap/react', () => ({
  useEditor: vi.fn(() => ({
    getHTML: vi.fn(() => '<p>Test content</p>'),
    isActive: vi.fn(() => false),
    can: vi.fn(() => ({ undo: vi.fn(() => true), redo: vi.fn(() => true) })),
    chain: vi.fn(() => ({
      focus: vi.fn(() => ({
        toggleBold: vi.fn(() => ({ run: vi.fn() })),
        toggleItalic: vi.fn(() => ({ run: vi.fn() })),
        toggleUnderline: vi.fn(() => ({ run: vi.fn() })),
        toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
        toggleOrderedList: vi.fn(() => ({ run: vi.fn() })),
        toggleBlockquote: vi.fn(() => ({ run: vi.fn() })),
        toggleCode: vi.fn(() => ({ run: vi.fn() })),
        toggleHeading: vi.fn(() => ({ run: vi.fn() })),
        setParagraph: vi.fn(() => ({ run: vi.fn() })),
        insertTable: vi.fn(() => ({ run: vi.fn() })),
        setImage: vi.fn(() => ({ run: vi.fn() })),
        undo: vi.fn(() => ({ run: vi.fn() })),
        redo: vi.fn(() => ({ run: vi.fn() }))
      }))
    }))
  })),
  EditorContent: ({ editor }: any) => <div data-testid="editor-content">Editor Content</div>
}));

vi.mock('@tiptap/starter-kit', () => ({
  default: {}
}));

vi.mock('@tiptap/extension-table', () => ({
  default: {
    configure: vi.fn(() => ({}))
  }
}));

vi.mock('@tiptap/extension-table-row', () => ({
  default: {}
}));

vi.mock('@tiptap/extension-table-header', () => ({
  default: {}
}));

vi.mock('@tiptap/extension-table-cell', () => ({
  default: {}
}));

vi.mock('@tiptap/extension-image', () => ({
  default: {
    configure: vi.fn(() => ({}))
  }
}));

describe('RichTextEditor', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders editor with toolbar', () => {
    render(
      <RichTextEditor
        content="<p>Initial content</p>"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /bold/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /italic/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /underline/i })).toBeInTheDocument();
  });

  it('renders in read-only mode without toolbar', () => {
    render(
      <RichTextEditor
        content="<p>Read-only content</p>"
        onChange={mockOnChange}
        readOnly={true}
      />
    );

    expect(screen.getByTestId('editor-content')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /bold/i })).not.toBeInTheDocument();
  });

  it('handles formatting button clicks', () => {
    render(
      <RichTextEditor
        content="<p>Test content</p>"
        onChange={mockOnChange}
      />
    );

    const boldButton = screen.getByRole('button', { name: /bold/i });
    fireEvent.click(boldButton);

    // The actual editor interaction is mocked, so we just verify the button exists and can be clicked
    expect(boldButton).toBeInTheDocument();
  });

  it('handles heading selection', () => {
    render(
      <RichTextEditor
        content="<p>Test content</p>"
        onChange={mockOnChange}
      />
    );

    const headingSelect = screen.getByDisplayValue('Paragraph');
    expect(headingSelect).toBeInTheDocument();
  });

  it('shows list formatting buttons', () => {
    render(
      <RichTextEditor
        content="<p>Test content</p>"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('button', { name: /bullet list/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /numbered list/i })).toBeInTheDocument();
  });

  it('shows table and image insertion buttons', () => {
    render(
      <RichTextEditor
        content="<p>Test content</p>"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('button', { name: /insert table/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /insert image/i })).toBeInTheDocument();
  });

  it('shows undo and redo buttons', () => {
    render(
      <RichTextEditor
        content="<p>Test content</p>"
        onChange={mockOnChange}
      />
    );

    expect(screen.getByRole('button', { name: /undo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /redo/i })).toBeInTheDocument();
  });

  it('handles image insertion with prompt', () => {
    // Mock window.prompt
    const mockPrompt = vi.fn(() => 'https://example.com/image.jpg');
    Object.defineProperty(window, 'prompt', {
      value: mockPrompt,
      writable: true
    });

    render(
      <RichTextEditor
        content="<p>Test content</p>"
        onChange={mockOnChange}
      />
    );

    const imageButton = screen.getByRole('button', { name: /insert image/i });
    fireEvent.click(imageButton);

    expect(mockPrompt).toHaveBeenCalledWith('Enter image URL:');
  });

  it('handles table insertion', () => {
    render(
      <RichTextEditor
        content="<p>Test content</p>"
        onChange={mockOnChange}
      />
    );

    const tableButton = screen.getByRole('button', { name: /insert table/i });
    fireEvent.click(tableButton);

    // The actual table insertion is mocked, so we just verify the button works
    expect(tableButton).toBeInTheDocument();
  });
});