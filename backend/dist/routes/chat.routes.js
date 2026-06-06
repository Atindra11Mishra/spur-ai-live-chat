"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const prisma_js_1 = require("../lib/prisma.js");
const router = (0, express_1.Router)();
router.post("/message", async (req, res) => {
    try {
        const { message, sessionId } = req.body;
        if (!message || typeof message !== "string" || message.trim().length === 0) {
            return res.status(400).json({
                error: "Message is required"
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
        const trimmedMessage = message.trim();
        await prisma_js_1.prisma.message.create({
            data: {
                conversationId,
                sender: "user",
                text: trimmedMessage
            }
        });
        const fakeReply = `This is a test AI reply. You said: "${trimmedMessage}"`;
        await prisma_js_1.prisma.message.create({
            data: {
                conversationId,
                sender: "ai",
                text: fakeReply
            }
        });
        return res.status(200).json({
            reply: fakeReply,
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
exports.default = router;
