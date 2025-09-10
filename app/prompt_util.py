def analyze_error_scenario(code, error, xml_summary):
    return f"""
Analyze the error and code, use the XML summary to understand the UI, and suggest a concise, actionable fix for the code or test.
Return your answer in the following JSON format:
{{
  "reason": "<Very Short explanation, less than 20 words>",
  "suggestedCodeChange": "<Suggested code change. Javascript>",
  "oldCode": "<Old code snippet>",
  "newCode": "<New code snippet>",
  "file": "<File to do the change>",
  "lineNumber": <Line number to do the change>
}}

Instructions:
- Reason: Explain the root cause in less than 20 words.
- Suggested code change: Describe the fix in one sentence.
- Old Code: Show the problematic code.
- New Code: Show the corrected code (if applicable).
- File: Suggest the file name (if known, else guess).
- Line Number: Suggest the line number (if known, else guess).
- Use the XML summary to find the closest matching element and base your suggestion on it.
- If no new code is needed, leave newCode blank.

Code with line numbers:
{code}

Error:
{error}

XML Snapshot Summary (JSON):
{xml_summary}
"""

def analyze_error_scenario_check_if_elem_exists_first(code, error, xml_summary):
    return f"""
Analyze the error and code, use the XML summary to understand the UI, and suggest a concise, actionable fix for the code or test.

Instructions:
1. Step 1 - If a self-healing element exists in the XML summary, provide a suggestion using it.
2. Step 2 if not Step 1 - Provide a check to verify if the element is displayed.

Return your answer in the following JSON format:
{{
  "reason": "<Very Short explanation, less than 20 words>",
  "suggestedCodeChange": "<Suggested code change. Javascript>",
  "oldCode": "<Old code snippet>",
  "newCode": "<New code snippet>",
  "file": "<File to do the change>",
  "lineNumber": <Line number to do the change>
}}

Code with line numbers:
{code}

Error:
{error}

XML Snapshot Summary (JSON):
{xml_summary}
"""