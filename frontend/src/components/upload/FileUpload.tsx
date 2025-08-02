import React, { useState, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  LinearProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  IconButton,
  Chip,
} from '@mui/material';
import {
  CloudUpload,
  InsertDriveFile,
  Delete,
  CheckCircle,
  Error,
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { dataApi } from '../../services/api';
import { Dataset } from '../../types/data';

interface FileUploadProps {
  onUploadSuccess?: (dataset: Dataset) => void;
  onUploadError?: (error: string) => void;
  acceptedFileTypes?: string[];
  maxFileSize?: number;
}

interface UploadFile {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  dataset?: Dataset;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadSuccess,
  onUploadError,
  acceptedFileTypes = ['.csv', '.xlsx', '.xls', '.json'],
  maxFileSize = 100 * 1024 * 1024, // 100MB
}) => {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([]);
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles: UploadFile[] = acceptedFiles.map(file => ({
      file,
      progress: 0,
      status: 'pending',
    }));
    
    setUploadFiles(prev => [...prev, ...newFiles]);
    
    // Start uploading files
    newFiles.forEach((fileToUpload, index) => {
      uploadFile(fileToUpload, uploadFiles.length + index);
    });
  }, [uploadFiles.length]);

  const uploadFile = async (fileToUpload: UploadFile, index: number) => {
    try {
      // Update status to uploading
      setUploadFiles(prev => 
        prev.map((f, i) => 
          i === index ? { ...f, status: 'uploading' } : f
        )
      );

      const response = await dataApi.uploadFile(
        fileToUpload.file,
        (progress) => {
          setUploadFiles(prev => 
            prev.map((f, i) => 
              i === index ? { ...f, progress } : f
            )
          );
        }
      );

      // Update status to success
      setUploadFiles(prev => 
        prev.map((f, i) => 
          i === index 
            ? { 
                ...f, 
                status: 'success', 
                progress: 100,
                dataset: response.data.data.dataset 
              } 
            : f
        )
      );

      if (onUploadSuccess) {
        onUploadSuccess(response.data.data.dataset);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || 'Upload failed';
      
      // Update status to error
      setUploadFiles(prev => 
        prev.map((f, i) => 
          i === index 
            ? { ...f, status: 'error', error: errorMessage } 
            : f
        )
      );

      if (onUploadError) {
        onUploadError(errorMessage);
      }
    }
  };

  const removeFile = (index: number) => {
    setUploadFiles(prev => prev.filter((_, i) => i !== index));
  };

  const { getRootProps, getInputProps, isDragActive: dropzoneActive } = useDropzone({
    onDrop,
    accept: {
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/json': ['.json'],
    },
    maxSize: maxFileSize,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    onDropAccepted: () => setIsDragActive(false),
    onDropRejected: () => setIsDragActive(false),
  });

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusIcon = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle color="success" />;
      case 'error':
        return <Error color="error" />;
      default:
        return <InsertDriveFile />;
    }
  };

  const getStatusColor = (status: UploadFile['status']) => {
    switch (status) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'uploading':
        return 'primary';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Paper
        {...getRootProps()}
        sx={{
          p: 4,
          border: '2px dashed',
          borderColor: isDragActive || dropzoneActive ? 'primary.main' : 'grey.300',
          backgroundColor: isDragActive || dropzoneActive ? 'primary.50' : 'grey.50',
          cursor: 'pointer',
          textAlign: 'center',
          transition: 'all 0.2s ease-in-out',
          '&:hover': {
            borderColor: 'primary.main',
            backgroundColor: 'primary.50',
          },
        }}
      >
        <input {...getInputProps()} />
        <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
        <Typography variant="h6" gutterBottom>
          {isDragActive || dropzoneActive
            ? 'Drop files here...'
            : 'Drag & drop files here, or click to select'}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Supported formats: {acceptedFileTypes.join(', ')}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Maximum file size: {formatFileSize(maxFileSize)}
        </Typography>
        <Button variant="contained" sx={{ mt: 2 }}>
          Select Files
        </Button>
      </Paper>

      {uploadFiles.length > 0 && (
        <Paper sx={{ mt: 3, p: 2 }}>
          <Typography variant="h6" gutterBottom>
            Upload Progress
          </Typography>
          <List>
            {uploadFiles.map((uploadFile, index) => (
              <ListItem
                key={index}
                secondaryAction={
                  <IconButton
                    edge="end"
                    onClick={() => removeFile(index)}
                    disabled={uploadFile.status === 'uploading'}
                  >
                    <Delete />
                  </IconButton>
                }
              >
                <ListItemIcon>
                  {getStatusIcon(uploadFile.status)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1">
                        {uploadFile.file.name}
                      </Typography>
                      <Chip
                        label={uploadFile.status}
                        size="small"
                        color={getStatusColor(uploadFile.status) as any}
                      />
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        {formatFileSize(uploadFile.file.size)}
                      </Typography>
                      {uploadFile.status === 'uploading' && (
                        <LinearProgress
                          variant="determinate"
                          value={uploadFile.progress}
                          sx={{ mt: 1 }}
                        />
                      )}
                      {uploadFile.error && (
                        <Alert severity="error" sx={{ mt: 1 }}>
                          {uploadFile.error}
                        </Alert>
                      )}
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default FileUpload;