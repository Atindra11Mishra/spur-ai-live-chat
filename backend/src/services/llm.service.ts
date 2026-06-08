import Groq from "groq-sdk";
import { CHAT_CONFIG } from "../config/chat.config.js";

type ChatHistoryMessage = {
  sender: "user" | "ai";
  text: string;
};

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

const STORE_KNOWLEDGE = `
Store name: SwiftCart

Shipping Policy:
- We ship across India in 3-5 business days.
- We ship to the USA in 7-12 business days.
- Free shipping is available on orders above Rs. 999.
- Orders are usually dispatched within 24 hours on business days.

Return and Refund Policy:
- Returns are accepted within 7 days of delivery.
- Items must be unused, unwashed, and in original packaging.
- Refunds are processed within 5-7 business days after quality inspection.
- Damaged or incorrect items are eligible for replacement or refund.

Support Hours:
- Customer support is available Monday to Saturday.
- Support hours are 10 AM to 7 PM IST.

Payments:
- We accept UPI, debit cards, credit cards, net banking, and wallet payments.
- Payments are processed securely through trusted payment partners.

Order Changes:
- Orders can be modified or cancelled only before they are dispatched.
- Once dispatched, the customer may request a return after delivery.
`;

function buildMessages(history: ChatHistoryMessage[], userMessage: string) {
  const recentHistory = history.slice(-8);

  return [
    {
      role: "system" as const,
      content: `
You are a helpful AI customer support agent for SwiftCart, a fictional ecommerce store.

Your behavior:
- Answer clearly and concisely.
- Be polite, calm, and professional.
- Use only the store knowledge provided below for policy-related answers.
- If the customer asks something outside the available policy, say you are not fully sure and suggest contacting human support.
- Do not invent shipping times, refund rules, discounts, or company policies.
- Keep answers short unless the user asks for detail.

Store knowledge:
${STORE_KNOWLEDGE}
`
    },
    ...recentHistory.map((message) => ({
      role: message.sender === "user" ? ("user" as const) : ("assistant" as const),
      content: message.text
    })),
    {
      role: "user" as const,
      content: userMessage
    }
  ];
}

export async function generateReply(
  history: ChatHistoryMessage[],
  userMessage: string
): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is missing");
  }

  const llmPromise = groq.chat.completions.create({
    model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
    messages: buildMessages(history, userMessage),
    temperature: 0.2,
    max_tokens: 250
  });

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error("LLM request timed out"));
    }, CHAT_CONFIG.LLM_TIMEOUT_MS);
  });

  const completion = await Promise.race([llmPromise, timeoutPromise]);

  const reply = completion.choices[0]?.message?.content;

  if (!reply) {
    throw new Error("LLM returned an empty response");
  }

  return reply.trim();
}
