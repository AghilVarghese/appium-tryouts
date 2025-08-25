from flask import Flask, request, jsonify
import os
from dotenv import load_dotenv
from app.llm_model import set_openai_api_key
from app.analysis import analyze_tests_with_llm, suggest_fixes_with_llm
from app.vectorstore import build_vectorstore, retrieve_relevant_files

# Load environment variables (for OpenAI API key, etc.)
load_dotenv()

app = Flask(__name__)




# Helper: Scan DIR for feature files and JS step definitions
def scan_test_suite(dir_path):
    features = []
    poms = []
    steps = []
    for root, _, files in os.walk(dir_path):
        for f in files:
            full_path = os.path.join(root, f)
            # Feature files: src/features/*.feature
            if f.endswith('.feature') and 'src/features' in full_path:
                features.append(full_path)
            # POM files: src/pageobjects/*.js
            elif f.endswith('.js') and 'src/pageobjects' in full_path:
                poms.append(full_path)
            # Test steps: src/steps/step_definitions/*.js
            elif f.endswith('.js') and 'src/steps/step_definitions' in full_path:
                steps.append(full_path)
    print(f"Scanned {len(features)} feature files, {len(poms)} POM files, and {len(steps)} step definition files in '{dir_path}'")
    return features, poms, steps

# Helper: Read JSON diff file
def read_json_diff(json_path):
    import json
    with open(json_path, 'r') as f:
        return json.load(f)

# Helper: Read file content
def read_file_content(path):
    with open(path, 'r') as f:
        return f.read()



# Combined API: scan, analyze, and suggest fixes
@app.route('/analyze_and_suggest', methods=['POST'])
def analyze_and_suggest():
    import json
    data = request.json
    dir_path = data['dir']
    json_file = data['json_file']
    features, poms, steps = scan_test_suite(dir_path)
    # Use all files: features, poms, and steps
    all_files = features + poms + steps
    json_diff = read_json_diff(json_file)
    # Use json_diff as loaded
    
    # Build vectorstore (one file = one chunk)
    print("Building vectorstore for all files...")
    backend = os.environ.get("LLM_BACKEND", "ollama").lower()
    vectordb = build_vectorstore(all_files, llm_backend=backend)

    # Use the diff as query to retrieve relevant files
    print("Retrieving relevant files for diff...")
    diff_text = str(json_diff)
    relevant_files = retrieve_relevant_files(diff_text, vectordb, k=5)
    
    # Only use relevant files in prompt
    feature_contents = "\n\n".join([read_file_content(f) for f in relevant_files])
    # Prepare a mapping of file path to content with line numbers
    file_contents_map = {}
    for f in all_files:
        with open(f, 'r') as file:
            lines = file.readlines()
            numbered_content = "".join([f"{i+1}: {line}" for i, line in enumerate(lines)])
            file_contents_map[f] = numbered_content
    # Step 1: Analyze
    analysis_raw = analyze_tests_with_llm(json_diff)
    try:
        analysis = json.loads(analysis_raw)
    except Exception:
        analysis = {"error": "LLM did not return valid JSON for analysis", "raw": analysis_raw}
    # Step 2: Suggest fixes
    suggestions_raw = suggest_fixes_with_llm(analysis_raw, file_contents_map)
    try:
        suggestions = json.loads(suggestions_raw)
    except Exception:
        suggestions = {"error": "LLM did not return valid JSON for suggestions", "raw": suggestions_raw}
    return jsonify({
        'analysis': analysis,
        'suggestions': suggestions
    })


if __name__ == '__main__':
    app.run(debug=True, port=5005)
