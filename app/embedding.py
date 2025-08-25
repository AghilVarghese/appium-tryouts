# embedding.py
from langchain_community.embeddings import OllamaEmbeddings, OpenAIEmbeddings
import os

def get_embedding_model(llm_backend="ollama"):
    if llm_backend == "openai":
        return OpenAIEmbeddings()
    else:
        return OllamaEmbeddings(model="nomic-embed-text")
