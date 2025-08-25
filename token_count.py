import tiktoken
import sys

def count_tokens_in_file(filepath, model="gpt-3.5-turbo"):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    enc = tiktoken.encoding_for_model(model)
    tokens = enc.encode(content)
    print(f"File: {filepath}")
    print(f"Token count: {len(tokens)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python count_tokens.py <file_path>")
    else:
        count_tokens_in_file(sys.argv[1])