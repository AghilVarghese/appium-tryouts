import os
import shutil
import stat
from flask import jsonify
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from datetime import datetime

# timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
CHROMA_PATH = f"./chroma_db_17"
CHROMA_PATH_POM_FILES = f"./chroma_pom_db_17"
vector_db = None
vector_db_pom = None

def create_chroma_db(docs):
    # Delete existing ChromaDB vector store directory if it exists, and recreate with correct permissions
    if os.path.exists(CHROMA_PATH):
        try:
            shutil.rmtree(CHROMA_PATH)
        except Exception as e:
            def onerror(func, path, exc_info):
                os.chmod(path, stat.S_IWRITE)
                func(path)
            shutil.rmtree(CHROMA_PATH, onerror=onerror)
    os.makedirs(CHROMA_PATH, exist_ok=True)
    os.chmod(CHROMA_PATH, 0o700)
    embeddings = OllamaEmbeddings(model="all-minilm:latest")
    db = Chroma.from_documents(docs, embeddings, persist_directory=CHROMA_PATH)
    db.persist()
    return db

def create_chroma_pom_db(docs):
    # Delete existing ChromaDB vector store directory if it exists, and recreate with correct permissions
    if os.path.exists(CHROMA_PATH_POM_FILES):
        try:
            shutil.rmtree(CHROMA_PATH_POM_FILES)
        except Exception as e:
            def onerror(func, path, exc_info):
                os.chmod(path, stat.S_IWRITE)
                func(path)
            shutil.rmtree(CHROMA_PATH_POM_FILES, onerror=onerror)
    os.makedirs(CHROMA_PATH_POM_FILES, exist_ok=True)
    os.chmod(CHROMA_PATH_POM_FILES, 0o700)
    embeddings = OllamaEmbeddings(model="all-minilm:latest")
    db = Chroma.from_documents(docs, embeddings, persist_directory=CHROMA_PATH_POM_FILES)
    db.persist()
    return db

def load_chroma_db():
    global vector_db
    if vector_db is None:
        try:
            embeddings = OllamaEmbeddings(model="all-minilm:latest")
            vector_db = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        except Exception as e:
            return None, str(e)
    return vector_db, None


def load_chroma_pom_db():
    global vector_db_pom
    if vector_db_pom is None:
        try:
            embeddings = OllamaEmbeddings(model="all-minilm:latest")
            vector_db_pom = Chroma(persist_directory=CHROMA_PATH_POM_FILES, embedding_function=embeddings)
        except Exception as e:
            return None, str(e)
    return vector_db_pom, None

def list_chroma_docs():
    db, err = load_chroma_db()
    if err:
        return jsonify({'error': f'Could not load vector database: {err}'}), 500
    try:
        docs = db.get(include=['metadatas', 'documents'])
        results = []
        for doc, meta in zip(docs.get('documents', []), docs.get('metadatas', [])):
            results.append({'content': doc, 'metadata': meta})
        return jsonify({'documents': results})
    except Exception as e:
        return jsonify({'error': f'Error reading vector database: {str(e)}'}), 500

def similarity_search(query, k=1):
    db, err = load_chroma_db()
    if err:
        return None, err
    try:
        docs = db.similarity_search(query, k=k)
        return docs, None
    except Exception as e:
        return None, str(e)

def similarity_search_pom(query, k=1):
    db, err = load_chroma_pom_db()
    if err:
        return None, err
    try:
        docs = db.similarity_search(query, k=k)
        return docs, None
    except Exception as e:
        return None, str(e)
