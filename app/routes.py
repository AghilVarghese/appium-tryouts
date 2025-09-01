from flask import Blueprint, request, jsonify
from .services import create_vector_db_pom_files, get_llm, load_vector_pom_db, scan_feature_files, scan_js_files, scan_js_functions, create_vector_db, load_vector_db, create_vector_db_step_definitions

main_bp = Blueprint('main', __name__)

@main_bp.route('/api/create-ragmodel', methods=['POST'])
def create_ragmodel():
    return create_vector_db(request)

@main_bp.route('/api/create-ragmodel-steps', methods=['POST'])
def create_ragmodel_steps():
    steps_response = create_vector_db_step_definitions(request)
    pom_response = create_vector_db_pom_files(request)
    combined_data = {
        "steps": steps_response.get_json() if hasattr(steps_response, "get_json") else steps_response,
        "pom": pom_response.get_json() if hasattr(pom_response, "get_json") else pom_response
    }
    return jsonify(combined_data)


@main_bp.route('/api/list-ragmodel', methods=['GET'])
def list_ragmodel():
    return load_vector_db(list_all=True)

@main_bp.route('/api/list-ragmodel-steps', methods=['GET'])
def list_ragmodel_steps():
    return load_vector_pom_db(list_all=True)

@main_bp.route('/api/query', methods=['POST'])
def query_ragmodel():
    return load_vector_db(query_request=request)


@main_bp.route('/api/clear-chromadb', methods=['POST'])
def clear_chromadb():
    from .services import clear_chroma_dbs
    return clear_chroma_dbs()

@main_bp.route('/api/query/step-definition', methods=['POST'])
def query_step_definition():
    from .services import query_step_definition
    return query_step_definition(request)

@main_bp.route('/api/query/pom-function', methods=['POST'])
def query_pom_function():
    from .services import query_pom_function
    return query_pom_function(request)

@main_bp.route('/api/suggest-fix-v1', methods=['POST'])
def suggest_fix_v1():
    from .services import suggest_fix_v1
    llm = request.args.get('llm')
    return suggest_fix_v1(request, llm_type=llm)