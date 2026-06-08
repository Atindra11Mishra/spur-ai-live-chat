# Spur AI Live Chat

A mini AI customer-support chat app built for the Spur Founding FullStack Engineer take-home assignment.

The app simulates a live chat widget for a fictional ecommerce store, SwiftCart. Users can ask support questions, the backend persists the conversation, sends the recent chat history and store knowledge to an LLM, and returns an AI support reply.

## Tech Stack

- Frontend: SvelteKit, TypeScript, Vite
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Prisma
- LLM provider: Groq

## Features

- Live chat UI with user and AI message bubbles
- Enter-to-send and send button
- Loading and typing states
- Suggested starter questions
- Session-based conversation history
- Persisted conversations and messages
- Backend health check
- Input validation for empty and long messages
- Graceful error handling for backend and LLM failures
- Fictional ecommerce FAQ knowledge for shipping, returns, refunds, payments, and support hours

## Project Structure

```text
.
+-- backend
|   +-- prisma
|   |   +-- schema.prisma
|   +-- src
|       +-- app.ts
|       +-- server.ts
|       +-- config
|       +-- lib
|       +-- routes
|       +-- services
+-- frontend
    +-- src
        +-- routes
```

## Environment Variables

Create `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"
GROQ_API_KEY="your_groq_api_key"
GROQ_MODEL="llama-3.1-8b-instant"
PORT=5000
```

Create `frontend/.env`:

```env
VITE_API_URL=http://localhost:5000
```

Do not commit real API keys or database credentials.

## Run Locally

### 1. Install backend dependencies

```bash
cd backend
npm install
```

### 2. Set up the database

Make sure `DATABASE_URL` and `DIRECT_URL` are set in `backend/.env`, then run:

```bash
npx prisma generate
npx prisma db push
```

### 3. Start the backend

```bash
npm run dev
```

The backend runs on:

```text
http://localhost:5000
```

Health check:

```text
GET /health
```

### 4. Install frontend dependencies

Open a second terminal:

```bash
cd frontend
npm install
```

### 5. Start the frontend

```bash
npm run dev
```

The frontend runs on the Vite URL shown in the terminal, usually:

```text
http://localhost:5173
```

## API

### `POST /chat/message`

Request:

```json
{
  "message": "What is your return policy?",
  "sessionId": "optional-existing-session-id"
}
```

Response:

```json
{
  "reply": "Returns are accepted within 7 days of delivery...",
  "sessionId": "conversation-id"
}
```

### `GET /chat/:sessionId/messages`

Returns the saved messages for a conversation so the frontend can restore history after reload.

## Data Model

The app persists:

- `Conversation`: `id`, `createdAt`, `updatedAt`
- `Message`: `id`, `conversationId`, `sender`, `text`, `createdAt`

`sender` is either:

- `user`
- `ai`

## Backend Architecture

- `src/app.ts`: Express app, middleware, health route, chat route mounting
- `src/server.ts`: loads environment variables and starts the server
- `src/routes/chat.routes.ts`: request validation, persistence flow, API responses
- `src/services/llm.service.ts`: Groq integration and prompt construction
- `src/lib/prisma.ts`: Prisma client setup
- `src/config/chat.config.ts`: message length, history size, and timeout limits

The LLM call is wrapped behind `generateReply(history, userMessage)` so the provider can be changed later without rewriting the route layer.

## LLM Notes

This project uses Groq as the LLM provider. The prompt includes:

- A system instruction to behave as a concise ecommerce support agent
- Hardcoded SwiftCart policy knowledge
- Recent conversation history for context
- Guardrails to avoid inventing policies outside the provided knowledge

The backend caps:

- Maximum message length: `2000` characters
- Maximum history sent to the LLM: `20` saved messages, with the service using the most recent context
- LLM timeout: `15000ms`
- Reply length via `max_tokens`

If the LLM call fails because of a timeout, invalid key, rate limit, or network issue, the backend catches the error and returns a friendly fallback reply instead of crashing.

## Validation And Robustness

The backend rejects:

- Missing or non-string messages
- Empty messages
- Messages above the configured maximum length
- Invalid `sessionId` types

If a provided `sessionId` does not exist, the backend starts a new conversation instead of failing the chat flow.

## Build And Checks

Backend:

```bash
cd backend
npm run build
```

Frontend:

```bash
cd frontend
npm run check
npm run build
```

## Deployment Notes

One simple deployment path:

- Backend: Render
- Frontend: Vercel or Netlify
- Database: Supabase PostgreSQL, Neon, or Render PostgreSQL

For deployment:

- Set backend env vars on the backend host.
- Set `VITE_API_URL` on the frontend host to the deployed backend URL.
- Run `npx prisma db push` or an equivalent Prisma deployment step against the production database.

## Tradeoffs And If I Had More Time

- Add automated backend route tests for validation, persistence, and LLM failure behavior.
- Add stricter production CORS based on allowed frontend origins.
- Add streaming responses for a more natural chat experience.
- Add retry support for failed messages in the UI.
- Add a small admin/debug view for conversations during development.
- Move store knowledge from hardcoded prompt text into database-managed FAQ records.
- Add deployment-specific adapters/config once the final hosting platform is selected.
