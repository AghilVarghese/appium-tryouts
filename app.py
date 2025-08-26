from flask import request
from langchain_community.llms import Ollama
from langchain_community.llms import OpenAI as LangchainOpenAI
from langchain.chains import RetrievalQA
from flask import Flask, request, jsonify
import os
import glob
import re
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain.schema import Document

app = Flask(__name__)

CHROMA_PATH = "./chroma_db"
vector_db = None

# Helper to get LLM
def get_llm(llm_type="ollama"):
    if llm_type == "openai":
        # Requires OPENAI_API_KEY in environment
        return LangchainOpenAI()
    # Default: Ollama deepseek-coder:latest
    return Ollama(model="deepseek-coder:latest")

# API to query the RAG model
@app.route('/api/query', methods=['POST'])
def query_ragmodel():
    global vector_db
    data = request.get_json()
    query = data.get('query')
    llm_type = data.get('llm', 'ollama')
    if not query:
        return jsonify({'error': 'Missing query'}), 400
    # Load vector_db if not already loaded
    if vector_db is None:
        try:
            from langchain_community.embeddings import OllamaEmbeddings
            embeddings = OllamaEmbeddings(model="all-minilm:latest")
            from langchain_community.vectorstores import Chroma
            vector_db_local = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        except Exception as e:
            return jsonify({'error': f'Could not load vector database: {str(e)}'}), 500
    else:
        vector_db_local = vector_db
    # Similarity search: get top-k relevant docs
    k = 4  # You can adjust this value
    try:
        print(f"Received query: {query}")
        docs = vector_db_local.similarity_search(query, k=k)
        context = "\n\n".join([doc.page_content for doc in docs])
        llm = get_llm(llm_type)
        prompt = f"Context:\n{context}\n\nQuestion: {query}\nAnswer:"
        answer = llm(prompt)
        return jsonify({'answer': answer, 'sources': [d.metadata for d in docs]})
    except Exception as e:
        return jsonify({'error': f'LLM query failed: {str(e)}'}), 500


# Helper to extract JS functions with filename and line number
def extract_js_functions(js_file_path):
    functions = []
    with open(js_file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for idx, line in enumerate(lines):
        # Simple regex for function declarations (expand as needed)
        match = re.match(r"\s*function (\w+)\s*\(", line)
        if match:
            functions.append({
                'name': match.group(1),
                'line': idx + 1,
                'file': os.path.basename(js_file_path),
                'content': line.strip()
            })
        # Arrow function or method assignment
        match2 = re.match(r"\s*(\w+)\s*=\s*\(.*?\)\s*=>", line)
        if match2:
            functions.append({
                'name': match2.group(1),
                'line': idx + 1,
                'file': os.path.basename(js_file_path),
                'content': line.strip()
            })
    return functions

# Helper to scan feature files
def scan_feature_files(feature_folder):
    feature_docs = []
    for feature_file in glob.glob(os.path.join(feature_folder, '*.feature')):
        with open(feature_file, 'r', encoding='utf-8') as f:
            content = f.read()
        feature_docs.append(Document(page_content=content, metadata={
            'file': os.path.basename(feature_file)
        }))
    return feature_docs

# For step_definitions: each file as one document
def scan_js_files(js_folder):
    js_docs = []
    for js_file in glob.glob(os.path.join(js_folder, '*.js')):
        with open(js_file, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = f.readlines()
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

# For pageobjects: each function as one document
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

@app.route('/api/create-ragmodel', methods=['POST'])
def create_ragmodel():
    global vector_db
    data = request.get_json()
    folder_path = data.get('folder_path')
    if not folder_path or not os.path.isdir(folder_path):
        return jsonify({'error': 'Invalid folder_path'}), 400

    # Assume structure: features/ for .feature, steps/ and pom/ for JS
    feature_folder = os.path.join(folder_path, 'src/features')
    steps_folder = os.path.join(folder_path, 'src/steps/step_definitions')
    pom_folder = os.path.join(folder_path, 'src/pageobjects')

    # Clear existing ChromaDB vector store data if it exists
    docs = []
    feature_count = 0
    steps_count = 0
    pom_count = 0

    if os.path.isdir(feature_folder):
        feature_docs = scan_feature_files(feature_folder)
        docs.extend(feature_docs)
        feature_count = len(feature_docs)
    if os.path.isdir(steps_folder):
        steps_docs = scan_js_files(steps_folder)
        docs.extend(steps_docs)
        steps_count = len(steps_docs)
    if os.path.isdir(pom_folder):
        pom_docs = scan_js_files(pom_folder)
        docs.extend(pom_docs)
        pom_count = len(pom_docs)

    print(f"Feature files: {feature_count}")
    print(f"Step definition JS files: {steps_count}")
    print(f"Page object JS files: {pom_count}")

    if not docs:
        return jsonify({'error': 'No valid files found'}), 400

    # Create new ChromaDB vector store
    embeddings = OllamaEmbeddings(model="all-minilm:latest")
    vector_db = Chroma.from_documents(docs, embeddings, persist_directory=CHROMA_PATH)
    vector_db.persist()
    return jsonify({'status': 'RAG model created', 'documents_indexed': len(docs)})


# API to list all contents in the vector database
@app.route('/api/list-ragmodel', methods=['GET'])
def list_ragmodel():
    global vector_db
    # Load vector_db if not already loaded
    if vector_db is None:
        try:
            from langchain_community.embeddings import OllamaEmbeddings
            embeddings = OllamaEmbeddings(model="all-minilm:latest")
            from langchain_community.vectorstores import Chroma
            vector_db_local = Chroma(persist_directory=CHROMA_PATH, embedding_function=embeddings)
        except Exception as e:
            return jsonify({'error': f'Could not load vector database: {str(e)}'}), 500
    else:
        vector_db_local = vector_db
    # Get all documents (metadatas and contents)
    try:
        docs = vector_db_local.get(include=['metadatas', 'documents'])
        results = []
        for doc, meta in zip(docs.get('documents', []), docs.get('metadatas', [])):
            results.append({'content': doc, 'metadata': meta})
        return jsonify({'documents': results})
    except Exception as e:
        return jsonify({'error': f'Error reading vector database: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5010)
