import os
import json
from .in_memory_chrome_db import InMemoryChromaDB
from .llm_selector import get_llm
from .prompt_util import analyze_error_scenario, analyze_error_scenario_check_if_elem_exists_first
import logging
from langchain_core.messages import HumanMessage, AIMessage

from .xml_parser_android import summarize_android_xml

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def suggest_fix_service(failed_step, error_message, xml_content, llm_type=None, k=1, temperature=0.7):
    logger.info(f"Querying test steps DB for: {failed_step}")
    db = InMemoryChromaDB()
    test_step_result = db.query_test_steps(failed_step, k=k, temperature=temperature)
    logger.info(f"Test step query result: {test_step_result}")

    pom_files = db.query_pom_files(test_step_result[0].page_content, k=k, temperature=temperature) if test_step_result else []
    logger.info(f"POM file query result: {pom_files}")

    failed_code = pom_files[0].page_content if pom_files else ''
    logger.info(f"Failed code: {failed_code}")

    snapshot_summary = summarize_android_xml(xml_str=xml_content)
    logger.info(f"Snapshot summary: {snapshot_summary}")

    # prompt = analyze_error_scenario(failed_code, error_message, snapshot_summary)
    prompt = analyze_error_scenario_check_if_elem_exists_first(failed_code, error_message, snapshot_summary)
    logger.info(f"Generated prompt: {prompt}")

    llm_type = llm_type or os.getenv("LLMTYPE", "ollama")
    logger.info(f"Using LLM type: {llm_type}")
    llm = get_llm(llm_type)
    if llm_type == "openai":
        answer = llm([HumanMessage(content=prompt)])
        logger.info(f"LLM answer: {answer}")
    else:
        answer = llm(prompt)
        logger.info(f"LLM answer: {answer}")

    parsed = None
    if isinstance(answer, AIMessage):
        msg_content = answer.content
        if msg_content.strip().startswith("```json"):
            msg_content = msg_content.strip().lstrip("```json").rstrip("```").strip()
        parsed = json.loads(msg_content)
    elif isinstance(answer, str):
        try:
            # Remove markdown code block if present
            if answer.strip().startswith("```json"):
                answer = answer.strip().lstrip("```json").rstrip("```").strip()
            parsed = json.loads(answer)
        except Exception as e:
            logger.error(f"Failed to parse LLM answer as JSON: {e}")
            parsed = {}
    elif isinstance(answer, dict):
        parsed = answer
    else:
        logger.error(f"Unexpected LLM answer type: {type(answer)}")
        parsed = {}

    response = {
        "reason": parsed.get("reason", ""),
        "suggestedCodeChange": parsed.get("suggestedCodeChange", ""),
        "oldCode": parsed.get("oldCode", failed_code),
        "newCode": parsed.get("newCode", ""),
        "file": parsed.get("file", ""),
        "file_path": parsed.get("file_path", ""),
        "lineNumber": parsed.get("lineNumber", 0)
    }
    logger.info(f"Final response: {response}")
    return response
