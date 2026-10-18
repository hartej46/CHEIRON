import React, { useState, useRef, useEffect } from "react";
import type { MatchStatus } from "./RemoteScreen";

export interface ChatMessage {
    id: string;
    sender: "you" | "stranger" | "system";
    text: string;
    timestamp: string;
}

interface ChatBoxProps {
    messages: ChatMessage[];
    status: MatchStatus;
    onSendMessage: (text: string) => void;
}

export const ChatBox: React.FC<ChatBoxProps> = ({
    messages,
    status,
    onSendMessage,
}) => {
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        onSendMessage(inputValue.trim());
        setInputValue("");
    };

    return (
        <section className="minimal-chat-container" aria-label="Conversation Log">
            <div className="chat-messages-scroll">
                {messages.length === 0 ? (
                    <div className="chat-empty-hint">
                        <span>Messages and status updates will appear here.</span>
                    </div>
                ) : (
                    messages.map((msg) => (
                        <div key={msg.id} className={`chat-bubble-row ${msg.sender}`}>
                            {msg.sender === "system" ? (
                                <div className="chat-system-message">
                                    <span className="system-dot" />
                                    <span>{msg.text}</span>
                                </div>
                            ) : (
                                <div className="chat-message-item">
                                    <span className="chat-sender-label">
                                        {msg.sender === "you" ? "You" : "Stranger"}
                                    </span>
                                    <span className="chat-bubble-content">{msg.text}</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSubmit} className="chat-input-form">
                <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={
                        status === "connected"
                            ? "Type a message and press enter..."
                            : "Connect with a partner to begin chatting..."
                    }
                    disabled={status !== "connected"}
                    className="chat-text-input"
                />
                <button
                    type="submit"
                    disabled={status !== "connected" || !inputValue.trim()}
                    className="btn-minimal btn-minimal-primary btn-chat-send"
                >
                    Send
                </button>
            </form>
        </section>
    );
};

export default ChatBox;
