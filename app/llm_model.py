# llm_model.py
from langchain_community.llms import Ollama
from langchain.llms import OpenAI
import openai
import os

_OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")

def set_openai_api_key(key: str):
    global _OPENAI_API_KEY
    _OPENAI_API_KEY = key
    openai.api_key = key

def get_llm():
    backend = os.environ.get("LLM_BACKEND", "ollama").lower()
    if backend == "openai":
        api_key = _OPENAI_API_KEY or os.environ.get("OPENAI_API_KEY")
        if api_key:
            openai.api_key = api_key
        return OpenAI(temperature=0, openai_api_key=api_key)
    return Ollama(model="deepseek-coder:6.7b", temperature=0.2)
