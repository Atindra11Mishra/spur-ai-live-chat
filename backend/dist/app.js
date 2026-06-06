"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const chat_routes_js_1 = __importDefault(require("./routes/chat.routes.js"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.get("/health", (_req, res) => {
    res.status(200).json({
        status: "ok",
        message: "Spur AI Live Chat backend is running"
    });
});
app.use("/chat", chat_routes_js_1.default);
exports.default = app;
