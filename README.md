# RAG Model Flask App

This app provides an API to create a vector database (ChromaDB) from Appium+Cucumber JavaScript test projects.

## Setup

1. Create and activate a virtual environment:
   ```sh
   python3 -m venv .venv
   source .venv/bin/activate
   ```
2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   ```

## Usage

Start the Flask server:
```sh
python app.py
```

### API

#### POST /api/create-ragmodel
- **Body:** `{ "folder_path": "/absolute/path/to/js/test/project" }`
- Scans:
  - All `.feature` files in the `features/` folder
  - All JS files in `steps/` and `pom/` folders (extracts functions with filename and line number)
- Indexes all content into ChromaDB for use in RAG workflows.

## Notes
- The vector database is persisted in `./chroma_db` and can be reused by other APIs.
- Requires OpenAI API key for embeddings (set `OPENAI_API_KEY` in your environment).
