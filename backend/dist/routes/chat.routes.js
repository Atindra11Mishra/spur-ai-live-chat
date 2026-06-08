"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = require("../lib/prisma.js");
const llm_service_js_1 = require("../services/llm.service.js");
const chat_config_js_1 = require("../config/chat.config.js");
const router = (0, express_1.Router)();
router.post("/message", async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        if (typeof message !== "string") {
            return res.status(400).json({
                error: "Message must be a valid text string"
            });
        }
        const trimmedMessage = message.trim();
        if (trimmedMessage.length === 0) {
            return res.status(400).json({
                error: "Message cannot be empty"
            });
        }
        if (trimmedMessage.length > chat_config_js_1.CHAT_CONFIG.MAX_MESSAGE_LENGTH) {
            return res.status(400).json({
                error: `Message is too long. Please keep it under ${chat_config_js_1.CHAT_CONFIG.MAX_MESSAGE_LENGTH} characters.`
            });
        }
        if (sessionId && typeof sessionId !== "string") {
            return res.status(400).json({
                error: "Invalid sessionId"
            });
        }
        let conversationId = sessionId;
        if (conversationId) {
            const existingConversation = await prisma_js_1.prisma.conversation.findUnique({
                where: {
                    id: conversationId
                }
            });
            if (!existingConversation) {
                conversationId = null;
            }
        }
        if (!conversationId) {
            const newConversation = await prisma_js_1.prisma.conversation.create({
                data: {}
            });
            conversationId = newConversation.id;
        }
        await prisma_js_1.prisma.message.create({
            data: {
                conversationId,
                sender: "user",
                text: trimmedMessage
            }
        });
        const previousMessages = await prisma_js_1.prisma.message.findMany({
            where: {
                conversationId
            },
            orderBy: {
                createdAt: "asc"
            },
            take: chat_config_js_1.CHAT_CONFIG.MAX_HISTORY_MESSAGES
        });
        const history = previousMessages.map((message) => ({
            sender: message.sender,
            text: message.text
        }));
        let aiReply;
        try {
            aiReply = await (0, llm_service_js_1.generateReply)(history, trimmedMessage);
        }
        catch (error) {
            console.error("LLM error:", error);
            aiReply =
                "Sorry, I am having trouble connecting to the support system right now. Please try again in a moment.";
        }
        await prisma_js_1.prisma.message.create({
            data: {
                conversationId,
                sender: "ai",
                text: aiReply
            }
        });
        return res.status(200).json({
            reply: aiReply,
            sessionId: conversationId
        });
    }
    catch (error) {
        console.error("POST /chat/message error:", error);
        return res.status(500).json({
            error: "Something went wrong while processing your message"
        });
    }
});
router.get("/:sessionId/messages", async (req, res) => {
    try {
        const { sessionId } = req.params;
        const conversation = await prisma_js_1.prisma.conversation.findUnique({
            where: {
                id: sessionId
            },
            include: {
                messages: {
                    orderBy: {
                        createdAt: "asc"
                    }
                }
            }
        });
        if (!conversation) {
            return res.status(404).json({
                error: "Conversation not found"
            });
        }
        return res.status(200).json({
            sessionId: conversation.id,
            messages: conversation.messages.map((message) => ({
                id: message.id,
                sender: message.sender,
                text: message.text,
                createdAt: message.createdAt
            }))
        });
    }
    catch (error) {
        console.error("GET /chat/:sessionId/messages error:", error);
        return res.status(500).json({
            error: "Something went wrong while fetching messages"
        });
    }
});
exports.default = router;
