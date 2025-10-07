import os
import glob
import re
from flask import jsonify
from langchain.schema import Document
import json
from .vector_db import create_chroma_db, create_chroma_pom_db, load_chroma_db, list_chroma_docs, load_chroma_pom_db, \
    similarity_search, similarity_search_pom
from .llm_selector import get_llm
from dotenv import load_dotenv


def scan_step_definitions(steps_folder):
    docs = []
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
    return docs


def scan_pom_files(pom_folder):
    docs = []
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
                        'file_path': js_file,
                        'function': func_name,
                        'code': ''.join(func_lines_with_numbers).strip()
                    }, ensure_ascii=False)
                    doc = Document(
                        page_content=content_json,
                        metadata={
                            'file': os.path.basename(js_file),
                            'file_path': js_file,
                            'relative_path': os.path.relpath(js_file, pom_folder),
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
                        'file_path': js_file,
                        'function': func_name,
                        'code': ''.join(func_lines_with_numbers).strip()
                    }, ensure_ascii=False)
                    doc = Document(
                        page_content=content_json,
                        metadata={
                            'file': os.path.basename(js_file),
                            'relative_path': os.path.relpath(js_file, pom_folder),
                            'file_path': js_file,
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
                'file_path': js_file,
                'function': func_name,
                'code': ''.join(func_lines_with_numbers).strip()
            }, ensure_ascii=False)
            doc = Document(
                page_content=content_json,
                    metadata={
                        'file': os.path.basename(js_file),
                        'file_path': js_file,
                        'relative_path': os.path.relpath(js_file, pom_folder),
                        'start_line': func_start_line + 1,
                        'function': func_name
                    }
            )
            docs.append(doc)
    if not docs:
        return jsonify({'error': 'No functions found in pageobjects'}), 400
    return docs
