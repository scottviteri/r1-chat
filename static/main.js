/* 
  main.js: 
  This file has all the event listeners, SSE logic, multi-conversation code, etc.
*/

// DOM references
const userInputEl = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const stopBtn = document.getElementById('stopBtn');
const debugBtn = document.getElementById('debugBtn');
const conversationListEl = document.getElementById('conversationList');
const toggleSidebarBtn = document.getElementById('toggleSidebarBtn');
const newConversationBtn = document.getElementById('newConversationBtn');
const tempRange = document.getElementById('tempRange');
const tempValueSpan = document.getElementById('tempValue');
const topPRange = document.getElementById('topPRange');
const topPValueSpan = document.getElementById('topPValue');
const maxTokensBox = document.getElementById('maxTokensBox');

// A dictionary of SSE sources, one per conversation if needed
const evtSources = {};

let activeConversationId = null;

// Setup UI
tempRange.addEventListener('input', () => {
  tempValueSpan.textContent = tempRange.value;
});
topPRange.addEventListener('input', () => {
  topPValueSpan.textContent = topPRange.value;
});

// Hide/Show sidebar
toggleSidebarBtn.addEventListener('click', () => {
  const sidebar = document.getElementById('sidebar');
  if (sidebar.classList.contains('hidden')) {
    sidebar.classList.remove('hidden');
    toggleSidebarBtn.textContent = "Hide Sidebar";
  } else {
    sidebar.classList.add('hidden');
    toggleSidebarBtn.textContent = "Show Sidebar";
  }
});

// On load, fetch conversation list
window.addEventListener('DOMContentLoaded', () => {
  reloadConversationList();
});

// Fetch + display conversation list
function reloadConversationList() {
  fetch('/list_conversations')
    .then(r => r.json())
    .then(convoIds => {
      conversationListEl.innerHTML = "";

      convoIds.forEach(cid => {
        // Create a row container to hold the conversation name + delete button
        const rowDiv = document.createElement('div');
        rowDiv.classList.add('conversationRow'); // optional, for styling

        // Button for selecting the conversation
        const convoBtn = document.createElement('button');
        convoBtn.innerText = cid;
        convoBtn.addEventListener('click', () => {
          selectConversation(cid);
        });
        rowDiv.appendChild(convoBtn);

        // Trash icon button for deleting the conversation
        const deleteConvBtn = document.createElement('button');
        deleteConvBtn.textContent = "🗑️️"; 
        deleteConvBtn.classList.add('trashConvBtn');
        deleteConvBtn.style.marginLeft = "8px";
        deleteConvBtn.addEventListener('click', (evt) => {
          // Prevent the click from also selecting the conversation
          evt.stopPropagation();
          deleteConversation(cid);
        });
        rowDiv.appendChild(deleteConvBtn);

        // Add your new row to the sidebar
        conversationListEl.appendChild(rowDiv);
      });
    })
    .catch(err => console.error("Error loading conversation list:", err));
}

// "New Conversation" button
newConversationBtn.addEventListener('click', () => {
  fetch('/new_conversation', {method: 'POST'})
    .then(r => r.json())
    .then(data => {
      reloadConversationList().then(() => {
        selectConversation(data.conversation_id);
      });
    });
});

// Selecting a conversation
function selectConversation(cid) {
  activeConversationId = cid;
  fetch(`/conversation_history?conversation_id=${encodeURIComponent(cid)}`)
    .then(r => r.json())
    .then(msgs => {
      const convoDiv = getConversationDiv(cid);
      convoDiv.innerHTML = "";
      showConversationDiv(cid);

      // Reset all other conversation buttons to default background
      Object.keys(conversationButtons).forEach(otherCid => {
        conversationButtons[otherCid].style.backgroundColor = "#444";
      });
      // Highlight the newly selected conversation
      conversationButtons[cid].style.backgroundColor = "#666";

      // ---------------------------------------------------------
      // 1) Group messages into pairs: user -> assistant
      // ---------------------------------------------------------
      let i = 0;
      while (i < msgs.length) {
        // Create pairDiv with a class for styling
        const pairDiv = document.createElement('div');
        pairDiv.classList.add('pairDiv'); // uses .pairDiv styles from style.css

        convoDiv.appendChild(pairDiv);

        const pairIndex = i; // track index for deletion

        // If this message is from user, display it
        if (msgs[i].role === 'user') {
          pairDiv.innerHTML += "<strong>You:</strong> " + msgs[i].content + "<br>";
          i++;
          if (i < msgs.length && msgs[i].role === 'assistant') {
            pairDiv.innerHTML += "<strong>R1:</strong> " + msgs[i].content + "<br>";
            i++;
          }
        }
        else if (msgs[i].role === 'assistant') {
          pairDiv.innerHTML += "<strong>R1:</strong> " + msgs[i].content + "<br>";
          i++;
        } else {
          i++;
        }

        // Create an actions container in the top-right
        const pairActions = document.createElement('div');
        pairActions.classList.add('pairActions');
        pairDiv.appendChild(pairActions);

        // Trash button (larger icon)
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = "🗑️️"; // or some bigger Unicode "trash" symbol
        deleteBtn.classList.add('trashBtn');
        deleteBtn.addEventListener('click', () => {
          deletePair(cid, pairIndex);
        });
        pairActions.appendChild(deleteBtn);

        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.textContent = "📋"; // clipboard or "Copy"
        copyBtn.classList.add('copyBtn');
        copyBtn.addEventListener('click', () => {
          // Copy all text from this pair to clipboard
          // Use innerText to avoid copying HTML tags (or use textContent)
          const textToCopy = pairDiv.innerText;
          navigator.clipboard.writeText(textToCopy)
            .then(() => {
              console.log("Pair text copied to clipboard.");
            })
            .catch(err => {
              console.error("Failed to copy text:", err);
            });
        });
        pairActions.appendChild(copyBtn);

        // -------------------------------------------------------
        // 2) Render MathJax for this pair
        // -------------------------------------------------------
        if (window.MathJax) {
          window.MathJax.typesetPromise([pairDiv])
            .catch(err => console.error("MathJax render error:", err));
        }
      }

      scrollToBottom(convoDiv);
    });
}

// Show/hide conversation divs
function showConversationDiv(cid) {
  const conversationsArea = document.getElementById('conversationsArea');
  [...conversationsArea.children].forEach(child => {
    child.style.display = 'none';
  });
  const convoDiv = getConversationDiv(cid);
  convoDiv.style.display = 'block';
}

// Return or create the <div> for a given conversation
function getConversationDiv(cid) {
  let convoDiv = document.getElementById(`conversation_${cid}`);
  if (!convoDiv) {
    convoDiv = document.createElement('div');
    convoDiv.id = `conversation_${cid}`;
    convoDiv.style.position = 'absolute';
    convoDiv.style.top = '0';
    convoDiv.style.left = '0';
    convoDiv.style.right = '0';
    convoDiv.style.bottom = '0';
    convoDiv.style.overflowY = 'auto';
    convoDiv.style.padding = '1em';
    convoDiv.style.display = 'none';
    document.getElementById('conversationsArea').appendChild(convoDiv);
  }
  return convoDiv;
}

function scrollToBottom(div) {
  div.scrollTop = div.scrollHeight;
}

// Send message on Enter or by sendBtn
userInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    submitForm();
  }
});
sendBtn.addEventListener('click', () => {
  submitForm();
});

// Submit user message
function submitForm() {
  const userInput = userInputEl.value.trim();
  if (!userInput || !activeConversationId) {
    alert("Please select or create a conversation first.");
    return;
  }

  // Create a new "pair" container for user→assistant exchange
  const conversationDiv = getConversationDiv(activeConversationId);
  const pairDiv = document.createElement('div');
  pairDiv.style.padding = '8px';
  pairDiv.style.border = '1px solid #444';
  pairDiv.style.margin = '8px 0';
  conversationDiv.appendChild(pairDiv);

  // Show user message
  pairDiv.innerHTML = "You: " + userInput + "<br>";
  scrollToBottom(conversationDiv);
  userInputEl.value = "";

  const temperature = parseFloat(tempRange.value);
  const top_p = parseFloat(topPRange.value);
  const max_tokens = parseInt(maxTokensBox.value, 10);

  fetch('/send_message', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      text: userInput,
      temperature,
      top_p,
      max_tokens,
      conversation_id: activeConversationId
    })
  })
  .then(response => {
    if (!response.ok) {
      throw new Error('Failed to send user message');
    }
    return response.json();
  })
  .then(data => {
    const s_id = data.stream_id;
    startStream(activeConversationId, s_id, pairDiv);
  })
  .catch(err => {
    console.error(err);
  });
}

// Start SSE streaming for the conversation/stream ID
function startStream(conversationId, streamId, pairDiv) {
  let chunkCount = 0;

  if (evtSources[conversationId]) {
    evtSources[conversationId].close();
  }
  const source = new EventSource(`/stream?stream_id=${encodeURIComponent(streamId)}`);
  evtSources[conversationId] = source;

  source.onmessage = function(event) {
    if (event.data === "[DONE]") {
      source.close();
      // Final MathJax re-render
      if (window.MathJax) {
        window.MathJax.typesetPromise([pairDiv])
          .catch(err => console.error("Final MathJax render error:", err));
      }
      return;
    }
    else if (event.data.startsWith("[Request failed")) {
      pairDiv.innerHTML += "<br>" + event.data + "<br>";
      source.close();
      return;
    }

    // Normal chunk
    chunkCount++;

    // If this is the very first chunk, optionally prepend "R1:"
    if (chunkCount === 1) {
      pairDiv.innerHTML += "<strong>R1:</strong> ";
    }
    // Append the chunk directly
    pairDiv.innerHTML += event.data;

    // Re-run MathJax every so often (e.g. every 15 chunks)
    if (window.MathJax && (chunkCount % 15 === 0)) {
      console.log("Partial re-render at chunk " + chunkCount);
      window.MathJax.typesetPromise([pairDiv])
        .catch(err => console.error("MathJax partial render error:", err));
    }
  };

  source.onerror = function(err) {
    console.error(`EventSource error in conversation ${conversationId}:`, err);
    source.close();
  };
}

// Stop button
stopBtn.addEventListener('click', () => {
  if (!activeConversationId) {
    console.warn("No active conversation selected.");
    return;
  }
  const source = evtSources[activeConversationId];
  if (source) {
    source.close();
  }
  // Optionally call /stop_stream
  // fetch('/stop_stream', {...}) with the correct stream_id if trackable
  // Provide a small visual cue in the conversation
  const currentConvoDiv = getConversationDiv(activeConversationId);
  currentConvoDiv.innerHTML += "<br><em>[User stopped the stream]</em><br>";
});

// Delete conversation
function deleteConversation(cid) {
  if (!confirm(`Are you sure you want to delete conversation ${cid}?`)) {
    return;
  }
  fetch('/delete_conversation', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ conversation_id: cid })
  })
  .then(r => r.json())
  .then(data => {
    console.log("Delete response:", data);
    reloadConversationList();
    if (cid === activeConversationId) {
      activeConversationId = null;
      const currentConvoDiv = getConversationDiv(cid);
      currentConvoDiv.innerHTML = "";
    }
  })
  .catch(err => {
    console.error("Delete conversation error:", err);
  });
}

// Debug button
debugBtn.addEventListener('click', () => {
  if (!activeConversationId) {
    console.warn("No active conversation selected.");
    return;
  }
  fetch('/debug_print', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ conversation_id: activeConversationId })
  })
  .then(res => res.json())
  .then(data => {
    console.log("Server-side debug response:", data);
  })
  .catch(err => {
    console.error("debug_print error:", err);
  });
});

function deletePair(conversationId, pairIndex) {
  if (!confirm("Do you really want to remove this user–assistant pair?")) {
    return;
  }
  fetch('/delete_pair', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ 
      conversation_id: conversationId, 
      pair_index: pairIndex 
    })
  })
  .then(r => r.json())
  .then(data => {
    console.log("delete_pair response:", data);
    if (data.status === "ok") {
      // Reload the conversation to refresh the UI
      selectConversation(conversationId);
    } else {
      alert("Error deleting pair: " + data.message);
    }
  })
  .catch(err => {
    console.error("delete_pair error:", err);
  });
} 