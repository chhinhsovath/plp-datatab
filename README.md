# DataTab Clone

A comprehensive web-based statistical analysis platform that enables users to perform data analysis, create visualizations, and generate statistical reports without requiring advanced programming knowledge.

## Project Structure

```
datatab-clone/
├── frontend/          # React frontend application
├── backend/           # Node.js backend API
├── docker-compose.dev.yml  # Development environment
└── package.json       # Root package.json for monorepo
```

## Prerequisites

- Node.js 18+ and npm 9+
- Docker and Docker Compose (for development environment)

## Development Setup

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install frontend dependencies
npm install --workspace=frontend

# Install backend dependencies
npm install --workspace=backend
```

### 2. Environment Configuration

Copy the example environment file and configure it:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your configuration values.

### 3. Start Development Environment

#### Option A: Using Docker (Recommended)

```bash
# Start all services (database, cache, backend, frontend)
npm run docker:dev
```

This will start:
- PostgreSQL database on port 5432
- Redis cache on port 6379
- MinIO object storage on ports 9000/9001
- Backend API on port 3001
- Frontend application on port 3000

#### Option B: Local Development

1. Start the database services:
```bash
docker-compose -f docker-compose.dev.yml up postgres redis minio -d
```

2. Set up the database:
```bash
cd backend
npx prisma migrate dev
npx prisma generate
```

3. Start the development servers:
```bash
# Start both frontend and backend
npm run dev

# Or start them separately
npm run dev:backend
npm run dev:frontend
```

## Available Scripts

### Root Level
- `npm run dev` - Start both frontend and backend in development mode
- `npm run build` - Build both applications for production
- `npm run test` - Run tests for both applications
- `npm run lint` - Lint both applications
- `npm run format` - Format code in both applications
- `npm run docker:dev` - Start development environment with Docker

### Frontend
- `npm run dev --workspace=frontend` - Start frontend development server
- `npm run build --workspace=frontend` - Build frontend for production
- `npm run test --workspace=frontend` - Run frontend tests
- `npm run lint --workspace=frontend` - Lint frontend code
- `npm run format --workspace=frontend` - Format frontend code

### Backend
- `npm run dev --workspace=backend` - Start backend development server
- `npm run build --workspace=backend` - Build backend for production
- `npm run test --workspace=backend` - Run backend tests
- `npm run lint --workspace=backend` - Lint backend code
- `npm run format --workspace=backend` - Format backend code

## Technology Stack

### Frontend
- React 18 with TypeScript
- Material-UI for components
- Chart.js/D3.js for visualizations
- React Query for state management
- Vite for build tooling

### Backend
- Node.js with Express.js
- TypeScript
- Prisma ORM with PostgreSQL
- Redis for caching
- Simple-statistics for statistical computations

### Development Tools
- ESLint for code linting
- Prettier for code formatting
- Vitest for testing
- Docker for containerization

## API Endpoints

- `GET /health` - Health check
- `GET /api/status` - API status

## Database

The application uses PostgreSQL with Prisma ORM. The database schema includes:
- Users
- Projects
- Datasets
- Analyses
- Reports

## Contributing

1. Follow the existing code style (ESLint + Prettier)
2. Write tests for new features
3. Update documentation as needed
4. Use conventional commit messages

## License

This project is licensed under the MIT License.


#DATATAB Database Configuration for Development
DB_HOST=157.10.73.52
DB_PORT=5432
DB_NAME=plp_datatab
DB_USER=admin
DB_PASSWORD=P@ssw0rd

OPENROUTER_API_KEY=sk-or-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


fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer <OPENROUTER_API_KEY>",
    "HTTP-Referer": “https://datatab.openplp.com”, // Optional. Site URL for rankings on openrouter.ai.
    "X-Title": “PLP Datatab”, // Optional. Site title for rankings on openrouter.ai.
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    "model": "google/gemma-3-27b-it:free",
    "messages": [
      {
        "role": "user",
        "content": [
          {
            "type": "text",
            "text": "What is in this image?"
          },
          {
            "type": "image_url",
            "image_url": {
              "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
            }
          }
        ]
      }
    ]
  })
});
# plp-datatab
