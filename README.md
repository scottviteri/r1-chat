# R1 Chat

An interactive chat application that supports:  
• Multiple parallel conversations.  
• Live streaming of partial responses (Server-Sent Events).  
• MathJax rendering for LaTeX expressions.  
• Conversation history saved on disk (JSON files).  
• Deletion of individual user–assistant pairs or entire conversations.  
• Automatic retrieval of Hyperbolic.ai API token from either an environment variable or a local file.

---

## Features

1. Multiple Conversations  
   • Keep track of many conversations in the left sidebar.  
   • Click a conversation to load its history.

2. Live Streaming SSE Responses  
   • Responses arrive chunk-by-chunk from the server.  
   • Progressively display partial text so you can see the model's response in real time.

3. MathJax Support  
   • Inline LaTeX like '$x^2+y^2$' is automatically rendered.  
   • Display math can also be used; e.g., '$$\frac{d}{dx} f(x)$$'.  
   • No browser errors if input contains standard LaTeX syntax.

4. Conversation Management  
   • Delete entire conversations.  
   • Remove specific user→assistant pairs.  
   • Copy button on each user–assistant pair to quickly copy text.

5. Hyperbolic.ai API Key Handling  
   • The Hyperbolic AI token is loaded from the environment variable HYPERBOLIC_API_KEY or from a file named ".hyperbolic_api_key" in the repository root.  
   • This ensures sensitive API credentials aren't hard-coded into the repo.

---

## Installation

1. Clone or download this repository:  
   git clone https://github.com/scottviteri/r1-chat.git  
   cd r1-chat  

2. (Optional) Create a virtual environment:  
   python -m venv venv  
   source venv/bin/activate  (on Windows: venv\Scripts\activate)

3. Install dependencies (Flask and requests):  
   pip install flask requests

4. Obtain a Hyperbolic.ai API token. You have two options:  
   a) Set an environment variable:  
      export HYPERBOLIC_API_KEY="YourHyperbolicKeyHere"  
   b) Or create a file named .hyperbolic_token at the root of the project, containing your token on a single line.  

5. (Optional) If you want to keep your .hyperbolic_token out of version control, add it to .gitignore.

---

## Usage

1. Start the Flask server:  
   python app.py  
   (By default, this runs on http://127.0.0.1:5000)

2. Open your browser to http://127.0.0.1:5000.  
   • The sidebar lists all existing conversations.  
   • Click "New Conversation" to start a fresh one.  
   • Type your query in the text area, then hit "Send."  
   • Watch partial responses stream in real time.  

3. You can adjust parameters:  
   • Temperature  
   • Top-p  
   • Max Tokens  

4. Deleting a conversation:  
   • Click the trash icon next to the conversation name in the sidebar.  
   • Confirm to permanently remove it (this also deletes its JSON file from /conversations).

5. Deleting a user–assistant pair:  
   • Open a conversation.  
   • Each pair shows a small trash icon in the top-right corner.  
   • Clicking it removes just that exchange from the JSON.

---

## Files & Structure

• app.py  
  Main Flask server. Includes routes for creating, streaming from, and managing conversations.  

• static/  
  - main.js: Client-side logic for new conversation, SSE streaming, conversation loading, pair deletion, etc.  
  - style.css: Basic dark-themed styling, plus layout for pairs and conversation rows.  

• templates/  
  - index.html: Main entry point. Loads style.css and main.js.  

• conversations/  
  - JSON files containing saved conversation histories. Named as <conversation_id>.json.  

• requirements.txt (if present)  
  - Lists Python dependencies.  

---

## Extending

• You can customize the SSE approach, the model name in app.py, or the styling in style.css.  
• If you want full Markdown rendering, you can integrate marked.js or another library (see prior code examples).  
• For advanced management, add more routes for searching, exporting, etc.

---

## Troubleshooting

1. "No Hyperbolic API Key found."  
   • Ensure you set HYPERBOLIC_API_KEY in your environment, or create .hyperbolic_api_key in root.  
   • Restart the Flask server.

2. "Request failed: ..."  
   • Check your internet connection or verify that the Hyperbolic.ai endpoint is up.  
   • Confirm your token is valid.

3. LaTeX not rendering properly  
   • Make sure your equation is enclosed in '$...$' or '$$...$$'.  
   • Check the console for MathJax parse warnings.

---

## License

© 2025 R1 Chat under the MIT License.

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

• The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

• THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE. 
