# prompt_templates.py
from langchain_core.prompts import PromptTemplate

analyze_prompt = PromptTemplate(
    input_variables=["json_diff"],
    template=(
        "You are an expert in Appium+Cucumber test automation. "
        "Given the following JSON diff of Android app element changes, identify ONLY the element name changes (e.g., 'etTo' changed to 'etToLocation'). "
        "For each change, output a JSON object with 'old_name', 'new_name', and a brief 'reason'. "
        "Ignore unrelated information. Respond ONLY with a raw JSON array of such changes.\n"
        "Respond ONLY with a raw JSON array. Do NOT include any explanation, code block, or text outside the JSON array. Do NOT use markdown or code fences.\n\n"
        "JSON DIFF:\n{json_diff}"
    )
)

suggest_fixes_prompt = PromptTemplate(
    input_variables=["issues", "file_contents_map"],
    template=(
        "You are an expert in Appium+Cucumber test automation. "
        "Given the following analyzed element name changes (as JSON):\n{issues}\n\n"
        "And the following mapping of file paths to their contents (with line numbers):\n{file_contents_map}\n\n"
        "For each change, identify the exact impacted file(s) and line(s) (using full file paths and line numbers as found in the mapping), "
        "and suggest a fix. Respond with a JSON array, each item containing: 'file' (full path), 'line', 'suggested_fix', and 'reason'. "
        "If the same change occurs in multiple places, list each occurrence separately with its file and line. "
        "Respond ONLY with a raw JSON array. Do NOT include any explanation, code block, or text outside the JSON array. Do NOT use markdown or code fences."
    )
)
