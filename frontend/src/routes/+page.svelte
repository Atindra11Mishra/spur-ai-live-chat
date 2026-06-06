<script lang="ts">
  import { onMount } from "svelte";

  type ChatMessage = {
    sender: "user" | "ai";
    text: string;
  };

const MAX_MESSAGE_LENGTH = 2000;

  const welcomeMessage: ChatMessage = {
    sender: "ai",
    text: "Hi! I am your support agent. Ask me about shipping, returns, refunds, or support hours."
  };

  let messages = $state<ChatMessage[]>([welcomeMessage]);
  let inputMessage = $state("");
  let isLoading = $state(false);
  let isHistoryLoading = $state(false);
  let errorMessage = $state("");
  let sessionId = $state<string | null>(null);

  const API_URL = import.meta.env.VITE_API_URL;
  const SESSION_STORAGE_KEY = "spur-chat-session-id";

  onMount(() => {
    const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);

    if (savedSessionId) {
      sessionId = savedSessionId;
      loadMessages(savedSessionId);
    }
  });

  async function loadMessages(savedSessionId: string) {
    isHistoryLoading = true;
    errorMessage = "";

    try {
      const response = await fetch(`${API_URL}/chat/${savedSessionId}/messages`);
      const data = await response.json();

      if (!response.ok) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        sessionId = null;
        messages = [welcomeMessage];
        return;
      }

      messages =
        data.messages.length > 0
          ? data.messages.map((message: ChatMessage) => ({
              sender: message.sender,
              text: message.text
            }))
          : [welcomeMessage];
    } catch (error) {
      console.error("Failed to load chat history:", error);
      messages = [welcomeMessage];
      errorMessage = "Could not load previous chat history.";
    } finally {
      isHistoryLoading = false;
    }
  }

  async function sendMessage() {
    const trimmedMessage = inputMessage.trim();
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
  errorMessage = `Please keep your message under ${MAX_MESSAGE_LENGTH} characters.`;
  return;
}

    if (!trimmedMessage || isLoading) {
      return;
    }

    errorMessage = "";

    messages = [
      ...messages,
      {
        sender: "user",
        text: trimmedMessage
      }
    ];

    inputMessage = "";
    isLoading = true;

    try {
      const response = await fetch(`${API_URL}/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: trimmedMessage,
          sessionId
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Something went wrong");
      }

      sessionId = data.sessionId;
      localStorage.setItem(SESSION_STORAGE_KEY, data.sessionId);

      messages = [
        ...messages,
        {
          sender: "ai",
          text: data.reply
        }
      ];
    } catch (error) {
      errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to reach support agent. Please try again.";

      messages = [
        ...messages,
        {
          sender: "ai",
          text: "Sorry, I could not process that message. Please try again."
        }
      ];
    } finally {
      isLoading = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  function startNewChat() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    sessionId = null;
    messages = [welcomeMessage];
    inputMessage = "";
    errorMessage = "";
  }
</script>

<main class="page">
  <section class="chat-card">
    <header class="chat-header">
  <div>
    <h1>SwiftCart Support</h1>
    <p>AI live chat assistant</p>
  </div>

  <div class="header-actions">
    <span class="status">Online</span>
    <button class="new-chat-button" type="button" onclick={startNewChat}>
      New
    </button>
  </div>
</header>

    <div class="messages">
    {#if isHistoryLoading}
  <div class="history-loading">Loading previous chat...</div>
{/if}
      {#each messages as message}
        <div class:message-row-user={message.sender === "user"} class="message-row">
          <div class:message-user={message.sender === "user"} class:message-ai={message.sender === "ai"} class="message-bubble">
            {message.text}
          </div>
        </div>
      {/each}

      {#if isLoading}
        <div class="message-row">
          <div class="message-bubble message-ai typing">Agent is typing...</div>
        </div>
      {/if}
    </div>

    {#if errorMessage}
      <p class="error">{errorMessage}</p>
    {/if}
<div class="input-meta">
  <span>{inputMessage.length}/{MAX_MESSAGE_LENGTH}</span>
</div>
    <form
  class="chat-input"
  onsubmit={(event) => {
    event.preventDefault();
    sendMessage();
  }}
>
     <input
  bind:value={inputMessage}
  onkeydown={handleKeydown}
  placeholder="Type your message..."
  disabled={isLoading || isHistoryLoading}
/> 

      <button type="submit" disabled={isLoading || !inputMessage.trim()}>
        {isLoading ? "Sending..." : "Send"}
      </button>
    </form>
  </section>
</main>

<style>
.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.input-meta {
  padding: 0 18px 8px;
  display: flex;
  justify-content: flex-end;
  font-size: 12px;
  color: #6b7280;
}
.new-chat-button {
  border: 1px solid rgba(255, 255, 255, 0.28);
  background: transparent;
  color: white;
  border-radius: 999px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}

.new-chat-button:hover {
  background: rgba(255, 255, 255, 0.12);
}

.history-loading {
  text-align: center;
  font-size: 13px;
  color: #6b7280;
  padding: 8px 0;
}
  :global(body) {
    margin: 0;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", sans-serif;
    background: #f4f6f8;
    color: #111827;
  }

  .page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .chat-card {
    width: 100%;
    max-width: 460px;
    height: 680px;
    background: white;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.12);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #e5e7eb;
  }

  .chat-header {
    padding: 20px;
    background: #111827;
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .chat-header h1 {
    font-size: 18px;
    margin: 0;
  }

  .chat-header p {
    margin: 4px 0 0;
    font-size: 13px;
    color: #d1d5db;
  }

  .status {
    font-size: 12px;
    background: #16a34a;
    padding: 5px 10px;
    border-radius: 999px;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .message-row {
    display: flex;
    justify-content: flex-start;
  }

  .message-row-user {
    justify-content: flex-end;
  }

  .message-bubble {
    max-width: 78%;
    padding: 11px 13px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.45;
    white-space: pre-wrap;
  }

  .message-ai {
    background: #f3f4f6;
    color: #111827;
    border-bottom-left-radius: 4px;
  }

  .message-user {
    background: #2563eb;
    color: white;
    border-bottom-right-radius: 4px;
  }

  .typing {
    color: #6b7280;
    font-style: italic;
  }

  .error {
    margin: 0 18px 10px;
    color: #dc2626;
    font-size: 13px;
  }

  .chat-input {
    border-top: 1px solid #e5e7eb;
    display: flex;
    gap: 10px;
    padding: 14px;
    background: #ffffff;
  }

  .chat-input input {
    flex: 1;
    border: 1px solid #d1d5db;
    border-radius: 999px;
    padding: 12px 14px;
    font-size: 14px;
    outline: none;
  }

  .chat-input input:focus {
    border-color: #2563eb;
  }

  .chat-input button {
    border: none;
    background: #111827;
    color: white;
    border-radius: 999px;
    padding: 0 18px;
    font-weight: 600;
    cursor: pointer;
  }

  .chat-input button:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
</style>