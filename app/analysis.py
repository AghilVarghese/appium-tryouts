# analysis.py
from app.llm_model import get_llm
from app.prompt_templates import analyze_prompt, suggest_fixes_prompt
from langchain_core.output_parsers import StrOutputParser

output_parser = StrOutputParser()

def analyze_tests_with_llm(json_diff):
    llm = get_llm()
    chain = analyze_prompt | llm | output_parser
    print(json_diff)
    result = chain.invoke({"json_diff": str(json_diff)})
    return result

def suggest_fixes_with_llm(issues, file_contents_map):
    llm = get_llm()
    chain = suggest_fixes_prompt | llm | output_parser
    prompt_input = {
        "issues": issues,
        "file_contents_map": file_contents_map,
    }
    print("Prompt to LLM:", prompt_input)
    return chain.invoke(prompt_input)
