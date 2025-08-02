import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import Image from '@tiptap/extension-image';
import {
  Box,
  Paper,
  Toolbar,
  IconButton,
  Divider,
  Select,
  MenuItem,
  FormControl,
  Tooltip
} from '@mui/material';
import {
  FormatBold,
  FormatItalic,
  FormatUnderlined,
  FormatListBulleted,
  FormatListNumbered,
  FormatQuote,
  Code,
  Table as TableIcon,
  Image as ImageIcon,
  Undo,
  Redo
} from '@mui/icons-material';

interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

const RichTextEditor: React.FC<RichTextEditorProps> = ({
  content,
  onChange,
  placeholder = 'Start writing...',
  readOnly = false
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
    ],
    content,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  if (!editor) {
    return null;
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const addTable = () => {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  };

  const setHeading = (level: number) => {
    if (level === 0) {
      editor.chain().focus().setParagraph().run();
    } else {
      editor.chain().focus().toggleHeading({ level: level as 1 | 2 | 3 | 4 | 5 | 6 }).run();
    }
  };

  return (
    <Paper elevation={1} sx={{ border: '1px solid #e0e0e0' }}>
      {!readOnly && (
        <Toolbar sx={{ borderBottom: '1px solid #e0e0e0', minHeight: '48px !important' }}>
          <FormControl size="small" sx={{ minWidth: 120, mr: 1 }}>
            <Select
              value={
                editor.isActive('heading', { level: 1 }) ? 1 :
                editor.isActive('heading', { level: 2 }) ? 2 :
                editor.isActive('heading', { level: 3 }) ? 3 : 0
              }
              onChange={(e) => setHeading(Number(e.target.value))}
            >
              <MenuItem value={0}>Paragraph</MenuItem>
              <MenuItem value={1}>Heading 1</MenuItem>
              <MenuItem value={2}>Heading 2</MenuItem>
              <MenuItem value={3}>Heading 3</MenuItem>
            </Select>
          </FormControl>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Tooltip title="Bold">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleBold().run()}
              color={editor.isActive('bold') ? 'primary' : 'default'}
            >
              <FormatBold />
            </IconButton>
          </Tooltip>

          <Tooltip title="Italic">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              color={editor.isActive('italic') ? 'primary' : 'default'}
            >
              <FormatItalic />
            </IconButton>
          </Tooltip>

          <Tooltip title="Underline">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              color={editor.isActive('underline') ? 'primary' : 'default'}
            >
              <FormatUnderlined />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Tooltip title="Bullet List">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              color={editor.isActive('bulletList') ? 'primary' : 'default'}
            >
              <FormatListBulleted />
            </IconButton>
          </Tooltip>

          <Tooltip title="Numbered List">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              color={editor.isActive('orderedList') ? 'primary' : 'default'}
            >
              <FormatListNumbered />
            </IconButton>
          </Tooltip>

          <Tooltip title="Quote">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              color={editor.isActive('blockquote') ? 'primary' : 'default'}
            >
              <FormatQuote />
            </IconButton>
          </Tooltip>

          <Tooltip title="Code">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().toggleCode().run()}
              color={editor.isActive('code') ? 'primary' : 'default'}
            >
              <Code />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Tooltip title="Insert Table">
            <IconButton size="small" onClick={addTable}>
              <TableIcon />
            </IconButton>
          </Tooltip>

          <Tooltip title="Insert Image">
            <IconButton size="small" onClick={addImage}>
              <ImageIcon />
            </IconButton>
          </Tooltip>

          <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

          <Tooltip title="Undo">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
            >
              <Undo />
            </IconButton>
          </Tooltip>

          <Tooltip title="Redo">
            <IconButton
              size="small"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
            >
              <Redo />
            </IconButton>
          </Tooltip>
        </Toolbar>
      )}

      <Box sx={{ p: 2, minHeight: 200 }}>
        <EditorContent
          editor={editor}
          style={{
            outline: 'none',
            minHeight: '150px',
            fontSize: '14px',
            lineHeight: '1.6'
          }}
        />
      </Box>

      <style jsx global>{`
        .ProseMirror {
          outline: none;
        }
        
        .ProseMirror h1 {
          font-size: 1.5em;
          font-weight: bold;
          margin: 0.5em 0;
        }
        
        .ProseMirror h2 {
          font-size: 1.3em;
          font-weight: bold;
          margin: 0.4em 0;
        }
        
        .ProseMirror h3 {
          font-size: 1.1em;
          font-weight: bold;
          margin: 0.3em 0;
        }
        
        .ProseMirror p {
          margin: 0.5em 0;
        }
        
        .ProseMirror ul, .ProseMirror ol {
          margin: 0.5em 0;
          padding-left: 1.5em;
        }
        
        .ProseMirror blockquote {
          border-left: 3px solid #ccc;
          margin: 0.5em 0;
          padding-left: 1em;
          font-style: italic;
        }
        
        .ProseMirror code {
          background-color: #f5f5f5;
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: monospace;
        }
        
        .ProseMirror table {
          border-collapse: collapse;
          margin: 1em 0;
          width: 100%;
        }
        
        .ProseMirror table td, .ProseMirror table th {
          border: 1px solid #ccc;
          padding: 0.5em;
          text-align: left;
        }
        
        .ProseMirror table th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        
        .ProseMirror img {
          max-width: 100%;
          height: auto;
        }
      `}</style>
    </Paper>
  );
};

export default RichTextEditor;