from langchain_community.llms import Ollama
from langchain_community.chat_models import ChatOpenAI
import os

_OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

def get_llm(llm_type="ollama"):
    if llm_type == "openai":
        return ChatOpenAI(
            temperature=0,
            api_key=_OPENAI_API_KEY,
            model="gpt-4-1106-preview"
        )
    return Ollama(model="deepseek-coder:latest")
    # return Ollama(model="codellama:13b")
    # return Ollama(model="llama3")