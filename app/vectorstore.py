# vectorstore.py
from langchain_community.vectorstores import Chroma
from langchain_core.documents import Document
from app.embedding import get_embedding_model
import os

def build_vectorstore(files, llm_backend="ollama"):
    docs = []
    for f in files:
        try:
            with open(f, 'r') as file:
                content = file.read()
            docs.append(Document(page_content=content, metadata={"file": f}))
        except Exception:
            continue
    embeddings = get_embedding_model(llm_backend)
    vectordb = Chroma.from_documents(docs, embeddings, persist_directory=".rag_index")
    return vectordb

def retrieve_relevant_files(diff_text, vectordb, k=3):
    results = vectordb.similarity_search(diff_text, k=k)
    return [doc.metadata["file"] for doc in results]
