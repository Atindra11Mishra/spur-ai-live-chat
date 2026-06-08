<script lang="ts">
  import { onMount } from "svelte";

  type MessageStatus = "sent" | "failed";

  type ChatMessage = {
    id: string;
    sender: "user" | "ai";
    text: string;
    createdAt: string;
    status?: MessageStatus;
  };

  type AgentStatus = "checking" | "online" | "offline";

  const MAX_MESSAGE_LENGTH = 2000;
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
  const SESSION_STORAGE_KEY = "spur-chat-session-id";

  const starterQuestions = [
    "What is your return policy?",
    "Do you ship to the USA?",
    "When is support available?"
  ];

  const createMessageId = () =>
    globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;

  const createWelcomeMessage = (): ChatMessage => ({
    id: "welcome",
    sender: "ai",
    text: "Hi, I am SwiftCart's support agent. I can help with shipping, returns, refunds, payments, and support hours.",
    createdAt: new Date().toISOString()
  });

  let messages = $state<ChatMessage[]>([createWelcomeMessage()]);
  let inputMessage = $state("");
  let isLoading = $state(false);
  let isHistoryLoading = $state(false);
  let errorMessage = $state("");
  let sessionId = $state<string | null>(null);
  let agentStatus = $state<AgentStatus>("checking");
  let messagesContainer = $state<HTMLDivElement>();

  const hasStartedConversation = $derived(
    messages.some((message) => message.id !== "welcome")
  );

  const remainingCharacters = $derived(MAX_MESSAGE_LENGTH - inputMessage.length);

  onMount(() => {
    checkBackendHealth();

    const savedSessionId = localStorage.getItem(SESSION_STORAGE_KEY);
    if (savedSessionId) {
      sessionId = savedSessionId;
      loadMessages(savedSessionId);
    }

    const healthCheckInterval = window.setInterval(checkBackendHealth, 30000);

    return () => {
      window.clearInterval(healthCheckInterval);
    };
  });

  $effect(() => {
    messages;
    isLoading;
    isHistoryLoading;
    window.setTimeout(scrollToLatest, 0);
  });

  async function checkBackendHealth() {
    try {
      const response = await fetch(`${API_URL}/health`);
      agentStatus = response.ok ? "online" : "offline";
    } catch {
      agentStatus = "offline";
    }
  }

  async function loadMessages(savedSessionId: string) {
    isHistoryLoading = true;
    errorMessage = "";

    try {
      const response = await fetch(`${API_URL}/chat/${savedSessionId}/messages`);
      const data = await response.json();

      if (!response.ok) {
        localStorage.removeItem(SESSION_STORAGE_KEY);
        sessionId = null;
        messages = [createWelcomeMessage()];
        return;
      }

      messages =
        data.messages.length > 0
          ? data.messages.map(
              (message: {
                id?: string;
                sender: "user" | "ai";
                text: string;
                createdAt?: string;
              }) => ({
                id: message.id || createMessageId(),
                sender: message.sender,
                text: message.text,
                createdAt: message.createdAt || new Date().toISOString()
              })
            )
          : [createWelcomeMessage()];
    } catch (error) {
      console.error("Failed to load chat history:", error);
      messages = [createWelcomeMessage()];
      errorMessage = "Could not load previous chat history. You can start a new message.";
    } finally {
      isHistoryLoading = false;
    }
  }

  async function sendMessage(messageOverride?: string) {
    const trimmedMessage = (messageOverride ?? inputMessage).trim();

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      errorMessage = `Please keep your message under ${MAX_MESSAGE_LENGTH} characters.`;
      return;
    }

    if (!trimmedMessage || isLoading || isHistoryLoading) {
      return;
    }

    const userMessageId = createMessageId();
    errorMessage = "";

    messages = [
      ...messages,
      {
        id: userMessageId,
        sender: "user",
        text: trimmedMessage,
        createdAt: new Date().toISOString(),
        status: "sent"
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
      agentStatus = "online";

      messages = [
        ...messages,
        {
          id: createMessageId(),
          sender: "ai",
          text: data.reply,
          createdAt: new Date().toISOString()
        }
      ];
    } catch (error) {
      agentStatus = "offline";
      errorMessage =
        error instanceof Error
          ? error.message
          : "Unable to reach support agent. Please try again.";

      messages = messages.map((message) =>
        message.id === userMessageId ? { ...message, status: "failed" } : message
      );
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
    messages = [createWelcomeMessage()];
    inputMessage = "";
    errorMessage = "";
  }

  function scrollToLatest() {
    if (!messagesContainer) {
      return;
    }

    messagesContainer.scrollTo({
      top: messagesContainer.scrollHeight,
      behavior: "smooth"
    });
  }

  function formatMessageTime(createdAt: string) {
    return new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(createdAt));
  }

  function statusLabel(status: AgentStatus) {
    if (status === "checking") return "Checking";
    if (status === "online") return "Online";
    return "Offline";
  }
</script>

<main class="page">
  <section class="chat-card" aria-label="SwiftCart support chat">
    <header class="chat-header">
      <div class="brand-block">
        <div class="brand-mark">S</div>
        <div>
          <h1>SwiftCart Support</h1>
          <p>AI live chat assistant</p>
        </div>
      </div>

      <div class="header-actions">
        <span class:status-online={agentStatus === "online"} class:status-offline={agentStatus === "offline"} class="status">
          {statusLabel(agentStatus)}
        </span>
        <button class="new-chat-button" type="button" onclick={startNewChat}>
          New chat
        </button>
      </div>
    </header>

    <div class="messages" bind:this={messagesContainer}>
      {#if isHistoryLoading}
        <div class="history-loading">Loading previous chat...</div>
      {/if}

      {#each messages as message (message.id)}
        <div class:message-row-user={message.sender === "user"} class="message-row">
          <div>
            <div
              class:message-user={message.sender === "user"}
              class:message-ai={message.sender === "ai"}
              class:message-failed={message.status === "failed"}
              class="message-bubble"
            >
              {message.text}
            </div>
            <div class:meta-user={message.sender === "user"} class="message-meta">
              <span>{message.sender === "user" ? "You" : "Agent"}</span>
              <span>{formatMessageTime(message.createdAt)}</span>
              {#if message.status === "failed"}
                <span class="failed-label">Not sent</span>
              {/if}
            </div>
          </div>
        </div>
      {/each}

      {#if !hasStartedConversation && !isHistoryLoading}
        <div class="starter-panel" aria-label="Suggested questions">
          {#each starterQuestions as question}
            <button type="button" onclick={() => sendMessage(question)} disabled={isLoading}>
              {question}
            </button>
          {/each}
        </div>
      {/if}

      {#if isLoading}
        <div class="message-row">
          <div>
            <div class="message-bubble message-ai typing">
              <span></span>
              <span></span>
              <span></span>
            </div>
            <div class="message-meta">
              <span>Agent is typing</span>
            </div>
          </div>
        </div>
      {/if}
    </div>

    {#if errorMessage}
      <div class="error" role="alert">
        <strong>Could not send message.</strong>
        <span>{errorMessage}</span>
      </div>
    {/if}

    <div class:limit-warning={remainingCharacters < 0} class="input-meta">
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
        aria-label="Message"
      />

      <button
        type="submit"
        disabled={isLoading || isHistoryLoading || !inputMessage.trim() || remainingCharacters < 0}
      >
        {isLoading ? "Sending" : "Send"}
      </button>
    </form>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", sans-serif;
    background: #eef2f7;
    color: #111827;
  }

  :global(*) {
    box-sizing: border-box;
  }

  .page {
    min-height: 100vh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }

  .chat-card {
    width: min(100%, 480px);
    height: min(720px, calc(100vh - 48px));
    min-height: 560px;
    background: #ffffff;
    border-radius: 18px;
    box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #dbe3ef;
  }

  .chat-header {
    padding: 18px;
    background: #172033;
    color: white;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
  }

  .brand-block,
  .header-actions {
    display: flex;
    align-items: center;
  }

  .brand-block {
    min-width: 0;
    gap: 11px;
  }

  .brand-mark {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    flex: 0 0 auto;
    background: #22c55e;
    color: #072014;
    font-weight: 800;
  }

  .chat-header h1 {
    font-size: 18px;
    line-height: 1.2;
    margin: 0;
  }

  .chat-header p {
    margin: 4px 0 0;
    font-size: 13px;
    color: #cbd5e1;
  }

  .header-actions {
    flex: 0 0 auto;
    gap: 8px;
  }

  .status {
    font-size: 12px;
    background: #64748b;
    color: white;
    padding: 5px 10px;
    border-radius: 999px;
  }

  .status-online {
    background: #16a34a;
  }

  .status-offline {
    background: #dc2626;
  }

  .new-chat-button {
    border: 1px solid rgba(255, 255, 255, 0.3);
    background: transparent;
    color: white;
    border-radius: 999px;
    padding: 6px 11px;
    font-size: 12px;
    cursor: pointer;
    white-space: nowrap;
  }

  .new-chat-button:hover {
    background: rgba(255, 255, 255, 0.12);
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 13px;
    background: #f8fafc;
  }

  .history-loading {
    text-align: center;
    font-size: 13px;
    color: #64748b;
    padding: 8px 0;
  }

  .message-row {
    display: flex;
    justify-content: flex-start;
  }

  .message-row-user {
    justify-content: flex-end;
  }

  .message-bubble {
    max-width: min(340px, 78vw);
    padding: 11px 13px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.45;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    border: 1px solid transparent;
  }

  .message-ai {
    background: #ffffff;
    color: #111827;
    border-color: #e2e8f0;
    border-bottom-left-radius: 5px;
  }

  .message-user {
    background: #2563eb;
    color: white;
    border-bottom-right-radius: 5px;
  }

  .message-failed {
    background: #fef2f2;
    color: #991b1b;
    border-color: #fecaca;
  }

  .message-meta {
    display: flex;
    gap: 7px;
    margin-top: 5px;
    color: #64748b;
    font-size: 11px;
  }

  .meta-user {
    justify-content: flex-end;
  }

  .failed-label {
    color: #dc2626;
    font-weight: 700;
  }

  .starter-panel {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding-top: 2px;
  }

  .starter-panel button {
    border: 1px solid #cbd5e1;
    background: #ffffff;
    color: #1e293b;
    border-radius: 999px;
    padding: 8px 11px;
    font-size: 13px;
    cursor: pointer;
  }

  .starter-panel button:hover {
    border-color: #2563eb;
    color: #1d4ed8;
  }

  .starter-panel button:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .typing {
    display: flex;
    align-items: center;
    gap: 5px;
    width: 54px;
    min-height: 38px;
  }

  .typing span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #94a3b8;
    animation: pulse 1s infinite ease-in-out;
  }

  .typing span:nth-child(2) {
    animation-delay: 0.12s;
  }

  .typing span:nth-child(3) {
    animation-delay: 0.24s;
  }

  .error {
    margin: 12px 18px 0;
    border: 1px solid #fecaca;
    background: #fef2f2;
    color: #991b1b;
    border-radius: 10px;
    padding: 10px 12px;
    font-size: 13px;
    display: grid;
    gap: 3px;
  }

  .input-meta {
    padding: 10px 18px 7px;
    display: flex;
    justify-content: flex-end;
    font-size: 12px;
    color: #64748b;
  }

  .limit-warning {
    color: #dc2626;
    font-weight: 700;
  }

  .chat-input {
    border-top: 1px solid #e2e8f0;
    display: flex;
    gap: 10px;
    padding: 0 14px 14px;
    background: #ffffff;
  }

  .chat-input input {
    flex: 1;
    min-width: 0;
    border: 1px solid #cbd5e1;
    border-radius: 999px;
    padding: 12px 14px;
    font-size: 14px;
    outline: none;
  }

  .chat-input input:focus {
    border-color: #2563eb;
    box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
  }

  .chat-input button {
    border: none;
    background: #172033;
    color: white;
    border-radius: 999px;
    padding: 0 18px;
    font-weight: 700;
    cursor: pointer;
  }

  .chat-input button:disabled {
    background: #94a3b8;
    cursor: not-allowed;
  }

  @keyframes pulse {
    0%,
    80%,
    100% {
      opacity: 0.35;
      transform: translateY(0);
    }

    40% {
      opacity: 1;
      transform: translateY(-3px);
    }
  }

  @media (max-width: 560px) {
    .page {
      padding: 0;
      align-items: stretch;
    }

    .chat-card {
      width: 100%;
      height: 100vh;
      min-height: 100vh;
      border-radius: 0;
      border: none;
    }

    .chat-header {
      align-items: flex-start;
      padding: 16px;
    }

    .header-actions {
      flex-direction: column;
      align-items: flex-end;
    }

    .messages {
      padding: 15px;
    }

    .message-bubble {
      max-width: 82vw;
    }

    .chat-input {
      padding: 0 12px 12px;
    }
  }
</style>
