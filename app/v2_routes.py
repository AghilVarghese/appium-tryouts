import os

from flask import Blueprint, request, jsonify

from app.in_memory_chrome_db import InMemoryChromaDB
from app.scanner import scan_step_definitions, scan_pom_files
from app.suggest_fix_service import suggest_fix_service

v2_app = Blueprint('v2_app', __name__)


@v2_app.route('/api/v2/index', methods=['POST'])
def api_index():
    _db().clear_dbs()
    data = request.get_json()
    dir = data.get('dir')
    test_steps_path = data.get('test_steps_rel_path')
    pom_files_path = data.get('pom_files_rel_path')
    steps_folder, pom_folder = os.path.join(dir, test_steps_path), os.path.join(dir, pom_files_path)
    step_definitons_docs, pom_docs = scan_step_definitions(steps_folder), scan_pom_files(pom_folder)
    add_records(step_definitons_docs, pom_docs)
    result = {'status': 'success', 'message': 'Indexing complete.'}
    return jsonify(result)


@v2_app.route('/api/v2/suggest-fix', methods=['POST'])
def api_suggest_fix():
    step = request.form.get('step')
    error = request.form.get('error')
    xml_file = request.files.get('xml_snapshot')
    llm_type = request.form.get('llm_type')
    k = int(request.form.get('k', 1))
    temperature = float(request.form.get('temperature', 0.7))
    xml_snapshot = xml_file.read().decode('utf-8') if xml_file else ''
    result = suggest_fix_service(step, error, xml_snapshot, llm_type, k=k, temperature=temperature)
    return jsonify(result)


@v2_app.route('/api/v2/list-test-steps', methods=['GET'])
def list_test_steps():
    db = InMemoryChromaDB()
    query = request.args.get('query', '')
    k = int(request.args.get('k', 5))
    temperature = float(request.args.get('temperature', 0.7))
    results = db.query_test_steps(query, k=k, temperature=temperature)
    return jsonify({'test_steps': [doc.page_content for doc in results]})


@v2_app.route('/api/v2/list-pom-files', methods=['GET'])
def list_pom_files():
    db = InMemoryChromaDB()
    query = request.args.get('query', '')
    k = int(request.args.get('k', 5))
    temperature = float(request.args.get('temperature', 0.7))
    results = db.query_pom_files(query, k=k, temperature=temperature)
    return jsonify({'pom_files': [doc.page_content for doc in results]})


def add_records(steps_docs, pom_docs):
    if not steps_docs:
        print("No test step documents to add. Skipping.")
    else:
        _db().add_test_step(steps_docs)
    if not pom_docs:
        print("No POM documents to add. Skipping.")
    else:
        _db().add_pom_file(pom_docs)


def _db():
    return InMemoryChromaDB()
