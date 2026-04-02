# Mandarin Vocabulary Miner

A modern, full-stack web application designed to help learners of Mandarin Chinese analyze word frequency in texts and track learning progress through interactive flashcards.

**Tech Stack**: React + Vite (frontend) | Django REST (backend)

## Features

### Core Learning Tools
- **Text Analysis**: Upload or paste Mandarin text to analyze word frequency distribution
- **HSK-Aware Vocabulary Screening**: Automatically categorize words by HSK level (1-9) to identify what you already know
- **Coverage Calculation**: Calculate the percentage of text you can understand based on your known vocabulary
- **Flashcard System**: Create, review, and track flashcards using SM-2 spaced repetition scheduling

### User Features
- **Account Management**: Register, login, and manage personal learning profile
- **Vocabulary Persistence**: Save your known vocabulary across sessions
- **Text Library**: Store and retrieve previously analyzed texts
- **Flashcard Export**: Export flashcards in Anki-compatible CSV format

## Project Structure

```
hanlearn_backend/          # Django REST API
├── miner_api/            # Core API app
│   ├── services.py       # Text analysis & vocabulary logic
│   ├── models.py         # User, Vocabulary, Flashcard models
│   ├── views.py          # API endpoints
│   └── urls.py           # Route definitions
├── settings.py           # Django configuration
├── wordlists/            # HSK vocabulary lists (JSON)
└── vocab.txt             # User vocabulary persistence

hanlearn_frontend/         # React + Vite frontend
├── src/
│   ├── pages/            # Page components
│   ├── components/       # Reusable UI components
│   └── App.tsx           # Main app component
├── vite.config.ts        # Vite configuration
└── tsconfig.json         # TypeScript configuration

streamlit_prototype/       # Legacy Streamlit app (archived)
```

## Installation

### Prerequisites
- Python 3.8+ with conda (or pip)
- Node.js 18+
- Git

### Backend Setup

1. Clone the repository:
    ```bash
    git clone https://github.com/jal9o3/Mandarin-Vocabulary-Miner.git
    cd Mandarin-Vocabulary-Miner
    ```

2. Set up Python environment:
    ```bash
    conda create -n hanlearn python=3.9
    conda activate hanlearn
    ```

3. Install backend dependencies:
    ```bash
    cd hanlearn_backend
    pip install -r requirements.txt  # or the equivalent Django + DRF deps
    ```

4. Run migrations:
    ```bash
    python manage.py migrate
    ```

5. Start the Django development server:
    ```bash
    python manage.py runserver
    ```
    The API will be available at `http://localhost:8000/api/`

### Frontend Setup

1. Navigate to frontend directory:
    ```bash
    cd hanlearn_frontend
    npm install
    ```

2. Start the development server:
    ```bash
    npm run dev
    ```
    The app will be available at `http://localhost:5173/`

### Running Both Services Together

Open two terminal windows:
- **Terminal 1** (Backend): `cd hanlearn_backend && python manage.py runserver`
- **Terminal 2** (Frontend): `cd hanlearn_frontend && npm run dev`

## API Endpoints

### Text Analysis

#### `POST /api/analyze`
Analyze Mandarin text for word frequency and coverage.

**Request:**
```json
{
  "text": "你好世界",
  "vocab_text": "你好 (optional)"
}
```

**Response:**
- Word frequency analysis with pinyin
- Coverage percentage based on known vocabulary
- Words grouped by HSK level

#### `POST /api/analyze-file`
Analyze a text file upload.

**Request:** `multipart/form-data`
- `file`: UTF-8 text file
- `vocab_text`: Optional known vocabulary

### Vocabulary Management

#### `POST /api/vocab-screen`
Screen text and categorize words by HSK level.

**Request:**
```json
{ "text": "你好世界" }
```

**Response:**
Words grouped into HSK 1-9 buckets for user selection.

**Note**: HSK lists sourced from [complete-hsk-vocabulary](https://github.com/drkameleon/complete-hsk-vocabulary). Files stored locally in `hanlearn_backend/wordlists/inclusive/new/` with fallback to GitHub raw URLs.

#### `GET /api/vocab`
Retrieve the current user's persisted vocabulary.

#### `POST /api/vocab/update` or `PUT /api/vocab/update`
Update user's known vocabulary.

**Request (either format):**
```json
{ "vocab_text": "word1 word2 word3" }
```
or
```json
{ "words": ["word1", "word2", "word3"] }
```

### Flashcard System

#### `POST /api/flashcards/create`
Create flashcards for authenticated user.

**Request:**
```json
{
  "words": [
    { "word": "你好", "pinyin": "ni3 hao3" }
  ]
}
```

**Note**: Requires authentication; guests must create an account first.

#### `GET /api/flashcards`
List user's flashcards with SM-2 scheduling data.

#### `PUT /api/flashcards/<id>` or `DELETE /api/flashcards/<id>`
Edit flashcard meaning or delete. When moving to an existing word, meanings are merged.

#### `GET /api/flashcards/export`
Export flashcards as Anki-compatible CSV (`Front`, `Back`).

### Authentication

#### `POST /api/auth/register`
Create a new account.

**Request:**
```json
{ "username": "...", "password": "..." }
```

#### `POST /api/auth/login`
Authenticate and start session.

**Request:**
```json
{ "username": "...", "password": "..." }
```

#### `GET /api/auth/me`
Check current authentication state.

#### `POST /api/auth/logout`
End the authenticated session.

## Project Evolution

This project evolved from a Streamlit prototype (see `streamlit_prototype/` for legacy code) to a modern full-stack web application. The core analysis logic from the prototype has been extracted into reusable backend services (`hanlearn_backend/miner_api/services.py`) and now powers a React frontend.

## Contributing

Contributions are welcome! Please fork the repository and submit a pull request with a clear description of your changes.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Contact

For questions or suggestions, please open an issue or contact the maintainer at jeromeloria333@gmail.com