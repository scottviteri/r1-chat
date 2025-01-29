from flask import Flask, request, render_template, Response, redirect, url_for, jsonify
import requests
import json
import uuid  # for generating unique stream_id
import os
from pathlib import Path

app = Flask(__name__)

# ---------------------------------------------------------------------
# Global variables and dictionaries
# ---------------------------------------------------------------------
API_URL = "https://api.hyperbolic.xyz/v1/chat/completions"

def load_hyperbolic_api_key():
    """
    Loads the Hyperbolic.ai API key by checking an environment variable
    named 'HYPERBOLIC_API_KEY' first. If that's not found, tries
    reading from a local file named '.hyperbolic_token'.
    """
    # 1) Check environment variable
    env_key = os.environ.get("HYPERBOLIC_API_KEY")
    if env_key:
        print("Using Hyperbolic API key from environment variable.")
        return env_key

    # 2) Fall back to local file, e.g. ".hyperbolic_token"
    token_file = Path(".hyperbolic_api_key")
    if token_file.is_file():
        try:
            with open(token_file, "r", encoding="utf-8") as f:
                file_token = f.read().strip()
                if file_token:
                    print(f"Loaded Hyperbolic API key from {token_file}")
                    return file_token
        except OSError as e:
            print(f"Could not read {token_file}: {e}")

    # 3) If neither is found, raise an error
    raise RuntimeError(
        "No Hyperbolic API key found. Please set HYPERBOLIC_API_KEY "
        "environment variable or create a .hyperbolic_token file."
    )

# Load the key just once at startup
HYPERBOLIC_API_KEY = load_hyperbolic_api_key()

stop_requested = {}      # "stream_id" -> bool
param_store = {}         # "stream_id" -> { temperature, top_p, max_tokens }
all_conversations = {}   # conversation_id -> list of messages

# Ensure the "conversations" directory exists
conversations_dir = Path("conversations")
conversations_dir.mkdir(exist_ok=True)

def load_all_conversations():
    """Load conversation JSON files from `conversations/` into all_conversations."""
    for file in conversations_dir.glob("*.json"):
        cid = file.stem  # filename without .json
        try:
            with open(file, "r", encoding="utf-8") as f:
                all_conversations[cid] = json.load(f)
        except (json.JSONDecodeError, OSError) as e:
            print(f"Could not load {file}: {e}")

def save_all_conversations(conversation_id):
    """Save a single conversation to `conversations/conversation_id.json`."""
    convo = all_conversations.get(conversation_id, [])
    file_path = conversations_dir / f"{conversation_id}.json"
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(convo, f, ensure_ascii=False, indent=2)
    except OSError as e:
        print(f"Could not save {file_path}: {e}")

# ---------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------

@app.route("/", methods=["GET"])
def index():
    """
    Serve the main chat interface. 
    """
    return render_template("index.html")

@app.route("/new_conversation", methods=["POST"])
def new_conversation():
    """
    Create a new conversation and return its ID.
    """
    cid = str(uuid.uuid4())
    all_conversations[cid] = []  # empty list of messages
    save_all_conversations(cid)
    return {"conversation_id": cid}, 200

@app.route("/list_conversations", methods=["GET"])
def list_conversations():
    """Return all conversation IDs as a JSON array."""
    return json.dumps(list(all_conversations.keys()))

@app.route("/conversation_history", methods=["GET"])
def conversation_history():
    """
    Return the entire conversation for a specific conversation_id as JSON.
    """
    cid = request.args.get("conversation_id", "")
    convo = all_conversations.get(cid, [])
    return json.dumps(convo)

@app.route("/send_message", methods=["POST"])
def send_message():
    data = request.get_json()
    user_text = data.get("text", "")
    cid = data.get("conversation_id", "")
    if cid not in all_conversations:
        return {"error": "Invalid conversation_id"}, 400

    all_conversations[cid].append({"role": "user", "content": user_text})
    save_all_conversations(cid)

    temperature = float(data.get("temperature", 0.1))
    top_p = float(data.get("top_p", 0.9))
    max_tokens = int(data.get("max_tokens", 100))

    s_id = str(uuid.uuid4())
    stop_requested[s_id] = False
    param_store[s_id] = {
        "temperature": temperature,
        "top_p": top_p,
        "max_tokens": max_tokens,
        "conversation_id": cid
    }

    return {"stream_id": s_id}, 200

@app.route("/stream", methods=["GET"])
def stream():
    s_id = request.args.get("stream_id", "")
    if s_id not in stop_requested:
        def error_stream():
            yield "data: [Request failed: invalid stream_id]\n\n"
        return Response(error_stream(), mimetype="text/event-stream")

    params = param_store.get(s_id, {})
    cid = params.get("conversation_id", "")
    temperature = float(params.get("temperature", 0.1))
    top_p = float(params.get("top_p", 0.9))
    max_tokens = int(params.get("max_tokens", 100))

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {HYPERBOLIC_API_KEY}",
    }
    payload = {
        "messages": all_conversations.get(cid, []),
        "model": "deepseek-ai/DeepSeek-R1-Zero",
        "max_tokens": max_tokens,
        "temperature": temperature,
        "top_p": top_p,
        "stream": True
    }

    def event_stream():
        try:
            # Insert an empty assistant message so we can build it chunk-by-chunk
            if cid in all_conversations:
                all_conversations[cid].append({"role": "assistant", "content": ""})
                save_all_conversations(cid)

            with requests.post(API_URL, headers=headers, json=payload, stream=True) as r:
                r.raise_for_status()

                for chunk in r.iter_lines(decode_unicode=True):
                    if stop_requested.get(s_id, False) is True:
                        yield "data: [DONE]\n\n"
                        break

                    if not chunk:
                        continue
                    if chunk.strip() == "data: [DONE]":
                        yield "data: [DONE]\n\n"
                        break

                    if chunk.startswith("data: "):
                        json_str = chunk[len("data: "):]
                        try:
                            parsed_obj = json.loads(json_str)
                            delta = parsed_obj.get("choices", [{}])[0].get("delta", {})
                            text_piece = delta.get("content", "")

                            # Append chunk to the last assistant message
                            if cid in all_conversations and all_conversations[cid]:
                                all_conversations[cid][-1]["content"] += text_piece
                                save_all_conversations(cid)

                            # Escape < and > for literal display
                            escaped_piece = text_piece.replace("<", "&lt;").replace(">", "&gt;")
                            yield f"data: {escaped_piece}\n\n"
                        except json.JSONDecodeError:
                            pass
        except requests.RequestException as e:
            yield f"data: [Request failed: {e}]\n\n"

        stop_requested.pop(s_id, None)

    return Response(event_stream(), mimetype="text/event-stream")

@app.route("/stop_stream", methods=["POST"])
def stop_stream():
    """
    Allows the front-end to request that a specific stream be stopped.
    Expects JSON: {stream_id: ...}
    """
    data = request.get_json()
    s_id = data.get("stream_id")
    if s_id in stop_requested:
        stop_requested[s_id] = True
    return {"status": "ok", "message": f"Stop request for {s_id}"}, 200

@app.route("/delete_conversation", methods=["POST"])
def delete_conversation():
    """
    Deletes the specified conversation from memory and disk.
    Expects JSON with {"conversation_id": "..."}.
    """
    data = request.get_json()
    cid = data.get("conversation_id")
    
    if cid in all_conversations:
        del all_conversations[cid]
        file_path = conversations_dir / f"{cid}.json"
        if file_path.exists():
            file_path.unlink()
        return {"status": "ok", "message": f"Conversation {cid} deleted"}, 200
    else:
        return {"status": "error", "message": "Invalid conversation_id"}, 400

@app.route("/debug_print", methods=["POST"])
def debug_print_server_side():
    data = request.get_json()
    cid = data.get("conversation_id")
    file_path = conversations_dir / f"{cid}.json"
    if not file_path.exists():
        return {"error": f"File not found for conversation_id: {cid}"}, 400
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            conversation_data = json.load(f)
        print(f"DEBUG PRINT (server side, from disk) for conversation {cid}:")
        print(json.dumps(conversation_data, indent=2))
        return {"status": "ok", "message": f"Printed contents of {file_path} to server logs"}, 200
    except (json.JSONDecodeError, OSError) as e:
        return {"error": f"Could not load file for conversation_id {cid}: {e}"}, 500

@app.route("/delete_pair", methods=["POST"])
def delete_pair():
    data = request.get_json()
    cid = data.get("conversation_id")
    pair_index = data.get("pair_index")

    if cid not in all_conversations:
        return jsonify({"status": "error", "message": "Unknown conversation"}), 400

    msgs = all_conversations[cid]
    # The index is guaranteed valid only if pair_index < len(msgs)
    if pair_index < 0 or pair_index >= len(msgs):
        return jsonify({"status": "error", "message": "Invalid pair_index"}), 400

    # 1) Remove the user message at pair_index
    msgs.pop(pair_index)

    # 2) If the new 'pair_index' is still < len(msgs) and that next 
    #    message has role 'assistant', pop it too
    if pair_index < len(msgs) and msgs[pair_index]["role"] == "assistant":
        msgs.pop(pair_index)

    # Save updated conversation
    all_conversations[cid] = msgs
    save_all_conversations(cid)

    return jsonify({"status": "ok"}), 200

# Load existing conversations before running
load_all_conversations()

if __name__ == "__main__":
    app.run(debug=True) 