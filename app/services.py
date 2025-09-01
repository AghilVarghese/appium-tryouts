import os
import glob
import re
from flask import jsonify
from langchain.schema import Document
from .vector_db import create_chroma_db, create_chroma_pom_db, load_chroma_db, list_chroma_docs, load_chroma_pom_db, similarity_search, similarity_search_pom
from .llm_selector import get_llm
from dotenv import load_dotenv
load_dotenv()

# Folder paths from environment variables
FEATURES_FOLDER = os.getenv('FEATURES_FOLDER', 'src/features')
STEP_DEFINITIONS_FOLDER = os.getenv('STEP_DEFINITIONS_FOLDER', 'src/steps/step_definitions')
PAGEOBJECTS_FOLDER = os.getenv('PAGEOBJECTS_FOLDER', 'src/pageobjects')




def scan_feature_files(feature_folder):
    feature_docs = []
    for feature_file in glob.glob(os.path.join(feature_folder, '*.feature')):
        with open(feature_file, 'r', encoding='utf-8') as f:
            content = f.read()
        feature_docs.append(Document(page_content=content, metadata={
            'file': os.path.basename(feature_file)
        }))
    return feature_docs

def scan_js_files(js_folder):
    js_docs = []
    for js_file in glob.glob(os.path.join(js_folder, '*.js')):
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()
        line_count = len(content.splitlines())
        doc = Document(
            page_content=content,
            metadata={
                'file': js_file,
                'start_line': 1,
                'end_line': line_count
            }
        )
        js_docs.append(doc)
    return js_docs

def scan_js_functions(js_folder):
    js_docs = []
    for js_file in glob.glob(os.path.join(js_folder, '*.js')):
        with open(js_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        for idx, line in enumerate(lines):
            match = re.match(r"\s*function (\w+)\s*\(", line)
            if match:
                func_name = match.group(1)
                doc = Document(
                    page_content=line.strip(),
                    metadata={
                        'file': js_file,
                        'line': idx + 1,
                        'function': func_name
                    }
                )
                js_docs.append(doc)
            match2 = re.match(r"\s*(\w+)\s*=\s*\(.*?\)\s*=>", line)
            if match2:
                func_name = match2.group(1)
                doc = Document(
                    page_content=line.strip(),
                    metadata={
                        'file': js_file,
                        'line': idx + 1,
                        'function': func_name
                    }
                )
                js_docs.append(doc)
    return js_docs

def create_vector_db(request):
    data = request.get_json()
    folder_path = data.get('folder_path')
    if not folder_path or not os.path.isdir(folder_path):
        return jsonify({'error': 'Invalid folder_path'}), 400
    feature_folder = os.path.join(folder_path, FEATURES_FOLDER)
    steps_folder = os.path.join(folder_path, STEP_DEFINITIONS_FOLDER)
    pom_folder = os.path.join(folder_path, PAGEOBJECTS_FOLDER)
    docs = []
    if os.path.isdir(feature_folder):
        docs.extend(scan_feature_files(feature_folder))
    if os.path.isdir(steps_folder):
        docs.extend(scan_js_files(steps_folder))
    if os.path.isdir(pom_folder):
        docs.extend(scan_js_functions(pom_folder))
    if not docs:
        return jsonify({'error': 'No valid files found'}), 400
    create_chroma_db(docs)
    return jsonify({'status': 'RAG model created', 'documents_indexed': len(docs)})

def load_vector_db(list_all=False, query_request=None):
    if list_all:
        # Return only serializable data, not Chroma object
        docs = list_chroma_docs()
        return docs
    if query_request:
        data = query_request.get_json()
        query = data.get('query')
        llm_type = data.get('llm', 'ollama')
        if not query:
            return jsonify({'error': 'Missing query'}), 400
        k = 1
        docs, err = similarity_search(query, k)
        if err:
            return jsonify({'error': f'LLM query failed: {err}'}), 500
        context = "\n\n".join([doc.page_content for doc in docs])
        llm = get_llm(llm_type)
        prompt = f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
        try:
            answer = llm(prompt)
            return jsonify({'answer': answer, 'sources': [d.metadata for d in docs]})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'LLM query failed: {str(e)}'}), 500
        
def load_vector_pom_db(list_all=False, query_request=None):
    if list_all:
        db, err = load_chroma_pom_db()
        if err:
            return jsonify({'error': f'Could not load POM vector database: {err}'}), 500
        try:
            docs = db.get(include=['metadatas', 'documents'])
            results = []
            for doc, meta in zip(docs.get('documents', []), docs.get('metadatas', [])):
                results.append({'content': doc, 'metadata': meta})
            return jsonify({'documents': results})
        except Exception as e:
            return jsonify({'error': f'Error reading POM vector database: {str(e)}'}), 500
    if query_request:
        data = query_request.get_json()
        query = data.get('query')
        llm_type = data.get('llm', 'ollama')
        if not query:
            return jsonify({'error': 'Missing query'}), 400
        k = 1
        docs, err = similarity_search_pom(query, k)
        if err:
            return jsonify({'error': f'LLM query failed: {err}'}), 500
        context = "\n\n".join([doc.page_content for doc in docs])
        llm = get_llm(llm_type)
        prompt = f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
        try:
            answer = llm(prompt)
            return jsonify({'answer': answer, 'sources': [d.metadata for d in docs]})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return jsonify({'error': f'LLM query failed: {str(e)}'}), 500

def create_vector_db_step_definitions(request):
    """
    Reads all JS step definition files from src/steps/step_definitions, extracts each Given/When/Then block (with line number),
    and adds each as a document in the vector database.
    Example file: /Users/LE1846/TestAutomation/v2/android_app_3/appium-cucumber-tests/src/steps/step_definitions/flights_page.steps.js
    """
    data = request.get_json()
    folder_path = data.get('folder_path')
    if not folder_path or not os.path.isdir(folder_path):
        return jsonify({'error': 'Invalid folder_path'}), 400
    steps_folder = os.path.join(folder_path, STEP_DEFINITIONS_FOLDER)
    if not os.path.isdir(steps_folder):
        return jsonify({'error': 'No step_definitions folder found'}), 400
    docs = []
    # For each JS file, extract all Given/When/Then blocks
    pattern = re.compile(r'^\s*(Given|When|Then)\s*\((.*)', re.DOTALL)
    for js_file in glob.glob(os.path.join(steps_folder, '*.js')):
        with open(js_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        in_block = False
        block_lines = []
        block_type = None
        block_start_line = None
        paren_count = 0
        for idx, line in enumerate(lines):
            match = pattern.match(line)
            if match:
                # Save previous block if any
                if in_block and block_lines:
                    doc = Document(
                        page_content=''.join(block_lines).strip(),
                        metadata={
                            'file': js_file,
                            'start_line': block_start_line + 1,
                            'block_type': block_type
                        }
                    )
                    docs.append(doc)
                in_block = True
                block_lines = [line]
                block_type = match.group(1)
                block_start_line = idx
                # Count parentheses to find block end
                paren_count = line.count('(') - line.count(')')
                continue
            if in_block:
                block_lines.append(line)
                paren_count += line.count('(') - line.count(')')
                if paren_count <= 0:
                    # Block ends
                    doc = Document(
                        page_content=''.join(block_lines).strip(),
                        metadata={
                            'file': js_file,
                            'start_line': block_start_line + 1,
                            'block_type': block_type
                        }
                    )
                    docs.append(doc)
                    in_block = False
                    block_lines = []
                    block_type = None
                    block_start_line = None
                    paren_count = 0
        # If file ends while in block
        if in_block and block_lines:
            doc = Document(
                page_content=''.join(block_lines).strip(),
                metadata={
                    'file': js_file,
                    'start_line': block_start_line + 1,
                    'block_type': block_type
                }
            )
            docs.append(doc)
    if not docs:
        return jsonify({'error': 'No Given/When/Then blocks found in step_definitions'}), 400
    create_chroma_db(docs)
    return jsonify({'status': 'Step definitions vector DB created', 'documents_indexed': len(docs)})

def create_vector_db_pom_files(request):
    """
    Reads all JS page object files from src/pageobjects, extracts each function (with line number),
    and adds each as a document in the vector database.
    Each function's content includes line numbers, and metadata includes file name and relative path.
    """
    data = request.get_json()
    folder_path = data.get('folder_path')
    if not folder_path or not os.path.isdir(folder_path):
        return jsonify({'error': 'Invalid folder_path'}), 400
    pom_folder = os.path.join(folder_path, PAGEOBJECTS_FOLDER)
    if not os.path.isdir(pom_folder):
        return jsonify({'error': 'No pageobjects folder found'}), 400
    docs = []
    import json
    for js_file in glob.glob(os.path.join(pom_folder, '*.js')):
        with open(js_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        in_function = False
        func_lines = []
        func_name = None
        func_start_line = None
        brace_count = 0
        for idx, line in enumerate(lines):
            # Match classic function
            match = re.match(r"\s*function\s+(\w+)\s*\(", line)
            # Match arrow function
            match2 = re.match(r"\s*(\w+)\s*=\s*\(.*?\)\s*=>", line)
            # Match class method (async or not)
            match3 = re.match(r"\s*(?:async\s+)?(\w+)\s*\((.*?)\)\s*{", line)
            if match or match2 or match3:
                if in_function and func_lines:
                    # Add line numbers to function lines
                    func_lines_with_numbers = [
                        f"{func_start_line + i + 1}: {l}" for i, l in enumerate(func_lines)
                    ]
                    content_json = json.dumps({
                        'file': os.path.basename(js_file),
                        'function': func_name,
                        'code': ''.join(func_lines_with_numbers).strip()
                    }, ensure_ascii=False)
                    doc = Document(
                        page_content=content_json,
                        metadata={
                            'file': os.path.basename(js_file),
                            'relative_path': os.path.relpath(js_file, folder_path),
                            'start_line': func_start_line + 1,
                            'function': func_name
                        }
                    )
                    docs.append(doc)
                in_function = True
                func_lines = [line]
                func_start_line = idx
                if match:
                    func_name = match.group(1)
                elif match2:
                    func_name = match2.group(1)
                else:
                    func_name = match3.group(1)
                brace_count = line.count('{') - line.count('}')
                continue
            if in_function:
                func_lines.append(line)
                brace_count += line.count('{') - line.count('}')
                if brace_count <= 0:
                    func_lines_with_numbers = [
                        f"{func_start_line + i + 1}: {l}" for i, l in enumerate(func_lines)
                    ]
                    content_json = json.dumps({
                        'file': os.path.basename(js_file),
                        'function': func_name,
                        'code': ''.join(func_lines_with_numbers).strip()
                    }, ensure_ascii=False)
                    doc = Document(
                        page_content=content_json,
                        metadata={
                            'file': os.path.basename(js_file),
                            'relative_path': os.path.relpath(js_file, folder_path),
                            'start_line': func_start_line + 1,
                            'function': func_name
                        }
                    )
                    docs.append(doc)
                    in_function = False
                    func_lines = []
                    func_name = None
                    func_start_line = None
                    brace_count = 0
        if in_function and func_lines:
            func_lines_with_numbers = [
                f"{func_start_line + i + 1}: {l}" for i, l in enumerate(func_lines)
            ]
            content_json = json.dumps({
                'file': os.path.basename(js_file),
                'function': func_name,
                'code': ''.join(func_lines_with_numbers).strip()
            }, ensure_ascii=False)
            doc = Document(
                page_content=content_json,
                metadata={
                    'file': os.path.basename(js_file),
                    'relative_path': os.path.relpath(js_file, folder_path),
                    'start_line': func_start_line + 1,
                    'function': func_name
                }
            )
            docs.append(doc)
    if not docs:
        return jsonify({'error': 'No functions found in pageobjects'}), 400
    create_chroma_pom_db(docs)
    return jsonify({'status': 'PageObjects vector DB created', 'documents_indexed': len(docs)})


def clear_chroma_dbs():
    """
    Deletes all records from ChromaDB collections (main and POM DBs) without deleting the directories.
    """
    from .vector_db import load_chroma_db, load_chroma_pom_db
    errors = []
    # Clear main DB
    db, err = load_chroma_db()
    if err:
        errors.append(f"Main DB: {err}")
    else:
        try:
            db.delete_collection()
        except Exception as e:
            errors.append(f"Main DB: {str(e)}")
    # Clear POM DB
    db_pom, err_pom = load_chroma_pom_db()
    if err_pom:
        errors.append(f"POM DB: {err_pom}")
    else:
        try:
            db_pom.delete_collection()
        except Exception as e:
            errors.append(f"POM DB: {str(e)}")
    if errors:
        return jsonify({'status': 'error', 'details': errors}), 500
    return jsonify({'status': 'cleared'})

def query_step_definition(request):
    """
    Search the CHROMA_PATH for the best matching step definition. Return the exact record or None if not found.
    Expects JSON: { "query": "When I select a departure city \"New York\"" }
    """
    data = request.get_json()
    query = data.get('query')
    if not query:
        return jsonify({'error': 'Missing query'}), 400
    k = 1
    docs, err = similarity_search(query, k)
    if err:
        return jsonify({'error': f'LLM query failed: {err}'}), 500
    # Try to find an exact match for the step text in the content
    for doc in docs:
        # Try to match the step text (ignoring parameters in curly braces)
        # Extract the quoted step from the query if present
        # import re
        # match = re.search(r"['\"](.+?)['\"]", query)
        # if match:
        #     step_text = match.group(1)
        #     if step_text in doc.page_content:
        #         return jsonify({'result': doc.page_content, 'metadata': doc.metadata})
        # # Fallback: check if the query (without quotes) is in the content
        # if query in doc.page_content:
        #     return jsonify({'result': doc.page_content, 'metadata': doc.metadata})
        return jsonify({'result': doc.metadata, 'content': doc.page_content})
        
    # No good match found
    return jsonify({'result': None})

def query_pom_function(request):
    """
    Receives a step definition content string, extracts method calls, and finds relevant POM function records from the vector DB.
    Expects JSON: { "content": "Given('I am on the Flights page', async function () { ... });" }
    """
    import re, json
    data = request.get_json()
    content = data.get('content')
    if not content:
        return jsonify({'error': 'Missing content'}), 400
    # Extract all method calls like obj.methodName(
    method_calls = re.findall(r'(\w+)\.(\w+)\s*\(', content)
    if not method_calls:
        return jsonify({'result': []})
    # Build a set of method names to search for
    method_names = set([m[1] for m in method_calls])
    # Search the POM vector DB for each method name
    db, err = load_chroma_pom_db()
    if err:
        return jsonify({'error': f'Could not load POM vector database: {err}'}), 500
    docs = db.get(include=['documents', 'metadatas'])
    results = []
    for doc, meta in zip(docs.get('documents', []), docs.get('metadatas', [])):
        try:
            doc_json = json.loads(doc)
        except Exception:
            continue
        func_name = doc_json.get('function')
        if func_name and func_name in method_names:
            results.append({'function': func_name, 'file': doc_json.get('file'), 'code': doc_json.get('code'), 'metadata': meta})
    return jsonify({'result': results})

def suggest_fix_v1(request, llm_type='ollama'):
    """
    Receives code (string), error (string), and xml snapshot (file), builds a prompt, sends to LLM, and returns the response.
    Summarizes the XML snapshot to JSON and includes the summary in the prompt.
    """
    import xml.etree.ElementTree as ET
    from .llm_selector import get_llm

    def summarize_android_xml(xml_str):
        root = ET.fromstring(xml_str)
        summary = []
        for elem in root.iter():
            attrs = {}
            for key in ["resource-id", "class", "text", "content-desc", "hint", "bounds"]:
                if key in elem.attrib and elem.attrib[key]:
                    attrs[key] = elem.attrib[key]
            if attrs:
                summary.append(attrs)
        return summary

    if request.content_type and request.content_type.startswith('multipart/form-data'):
        code = request.form.get('code')
        error = request.form.get('error')
        xml_file = request.files.get('xml_snapshot')
        xml_snapshot = xml_file.read().decode('utf-8') if xml_file else ''
    else:
        data = request.get_json()
        code = data.get('code')
        error = data.get('error')
        xml_snapshot = data.get('xml_snapshot', '')

    if not code or not error or not xml_snapshot:
        return jsonify({'error': 'Missing code, error, or xml_snapshot'}), 400

    try:
        xml_summary = summarize_android_xml(xml_snapshot)
    except Exception as e:
        return jsonify({'error': f'Failed to parse XML snapshot: {str(e)}'}), 400

    # Optimized prompt with XML summary
    prompt = f"""
Analyze the error and code, use the XML summary to understand the UI, and suggest a concise, actionable fix for the code or test.
1. Check if the selector is correct and accurately reflects the element's location in the UI hierarchy.
2. Use the XML summary to narrow down the locator strategy. For example, you could try using a different selector such as "resource-id" or "class" to locate the element.
3. If the issue persists, consider waiting for the element to appear before attempting to interact with it. This can be achieved by using the `waitForExist` method in Appium.
4. If none of the above suggestions work, try increasing the timeout value when waiting for the element to exist or to become clickable.
Important : Provide suggested code change only with the element in the xml only (xml here in the json provided - find the closest one from there)

Based on the analysis provide:
1. Reason - Very Short explanations less than 20 words.
2. Suggested code change - Suggested code change. Javascript.
3. New Code - <Provide new code. if no new code suggestion skip this>

Code with line numbers:
{code}

Error:
{error}

XML Snapshot Summary (JSON):
{xml_summary}
"""
    llm = get_llm(llm_type)
    try:
        print(prompt)
        answer = llm(prompt)
        # return jsonify({'suggestion': answer})
        return answer
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'LLM query failed: {str(e)}'}), 500

