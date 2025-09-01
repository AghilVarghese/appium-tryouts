from langchain_community.llms import Ollama
from langchain.llms import OpenAI
import os

_OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")

def get_llm(llm_type="ollama"):
    if llm_type == "openai":
        return OpenAI(temperature=0, openai_api_key=_OPENAI_API_KEY)
    # return Ollama(model="deepseek-coder:latest")
    return Ollama(model="codellama:13b")
