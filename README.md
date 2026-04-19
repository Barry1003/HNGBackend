# HNG Stage 1 - Backend Data Persistence & API Design

This is a Node.js/TypeScript backend application for the HNG Internship Stage 1. It provides an Information Classifier API that identifies gender, age, and nationality based on a name, and persists the data in a SQLite database.

## Features

- **Information Classification**: `GET /api/classify` identifies gender with confidence metrics.
- **Profile Management**: CRUD operations for user profiles with automatic data enrichment from external APIs.
- **Idempotency**: Automatic handling of duplicate profile creation requests.
- **Data Persistence**: Uses `sql.js` (SQLite) for reliable data storage.
- **Concurrency**: Optimized external API calls using `Promise.all`.
- **Filtering**: List profiles with filters for gender, country, and age group.

## Tech Stack

- **Runtime**: Node.js
- **Language**: TypeScript (using `tsx` for execution)
- **Framework**: Express.js
- **Database**: SQLite (`sql.js`)
- **External APIs**: Genderize.io, Agify.io, Nationalize.io

## API Endpoints

### Classification

- `GET /api/classify?name=<name>`: Classifies a name's gender and returns confidence data.

### Profiles

- `POST /api/profiles`: Creates a new profile. Body: `{ "name": "string" }`.
- `GET /api/profiles`: Lists all profiles with optional query filters (`gender`, `country_id`, `age_group`).
- `GET /api/profiles/:id`: Retrieves a single profile by ID.
- `DELETE /api/profiles/:id`: Deletes a profile.

## Getting Started

1. **Install dependencies**:

   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env` file from the example:

   ```text
   PORT=3000
   ```

3. **Run the server**:

   ```bash
   npm start
   ```

4. **Run tests**:
   ```bash
   npx tsx test_api.ts
   ```

## License

MIT
