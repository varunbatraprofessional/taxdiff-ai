import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, Chat, GenerateContentResponse } from "@google/genai";
import { Send, Bot, User, Loader2, MessageSquare, Download } from 'lucide-react';
import { ComparisonResult } from '../types';

interface ChatPanelProps {
  results: ComparisonResult | undefined;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

// Helper to extract CSV content from markdown code blocks
const extractCsv = (text: string): string | null => {
  // Matches ```csv ... ``` blocks
  const match = text.match(/```csv\s*([\s\S]*?)\s*```/i);
  if (match) return match[1];
  return null;
};

const downloadCsv = (content: string) => {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `taxdiff_export_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
};

const ChatPanel: React.FC<ChatPanelProps> = ({ results }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Chat Session when results change
  useEffect(() => {
    if (!results) {
        setMessages([]);
        chatSessionRef.current = null;
        return;
    }

    const apiKey = process.env.API_KEY;
    if (!apiKey) return;

    const ai = new GoogleGenAI({ apiKey });

    const context = `
      You are a specialized assistant for an IRS Tax Form Comparator tool.
      
      CONTEXT FOR CURRENT PAGE (Page ${results.pageNumber}):
      Summary: ${results.summary}
      
      CHANGES LIST:
      ${JSON.stringify(results.changes, null, 2)}
      
      INSTRUCTIONS:
      - Answer questions about the changes on this page.
      - If the user asks for a summary, use the provided summary or generate a specific one based on their constraints (e.g. "only high severity").
      - You can reference specific IDs (e.g. "c1") if helpful.
      - Format your responses clearly. Use whitespace to separate paragraphs or lists.
      - If the user requests a CSV export or table data, strictly wrap the output in a markdown code block with the language identifier 'csv' (i.e., \`\`\`csv ... \`\`\`).
    `;

    chatSessionRef.current = ai.chats.create({
      model: 'gemini-2.5-flash',
      config: {
        systemInstruction: context,
      },
    });

    setMessages([{ 
        role: 'model', 
        text: `I'm ready to discuss the changes on Page ${results.pageNumber}. What would you like to know?` 
    }]);
  }, [results]);

  const handleSend = async () => {
    if (!input.trim() || !chatSessionRef.current) return;
    
    const userText = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsLoading(true);

    try {
      const result = await chatSessionRef.current.sendMessageStream({ message: userText });
      
      setMessages(prev => [...prev, { role: 'model', text: '' }]);
      
      let fullText = '';
      for await (const chunk of result) {
        const text = (chunk as GenerateContentResponse).text;
        if (text) {
            fullText += text;
            setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1].text = fullText;
                return updated;
            });
        }
      }
    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, { role: 'model', text: 'Error: Could not connect to Gemini.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!results) {
    return (
        <div className="h-full flex flex-col items-center justify-center p-8 text-slate-400 text-center bg-slate-50">
            <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
            <p>Analyze a page to start a chat about the changes.</p>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => {
          const csvContent = msg.role === 'model' ? extractCsv(msg.text) : null;
          
          return (
            <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'model' && (
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
                        <Bot className="w-5 h-5 text-blue-600" />
                    </div>
                )}
                <div className="flex flex-col items-start max-w-[85%]">
                    <div className={`
                        rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm whitespace-pre-wrap
                        ${msg.role === 'user' 
                            ? 'bg-blue-600 text-white rounded-tr-none' 
                            : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'}
                    `}>
                        {msg.text}
                    </div>
                    
                    {csvContent && (
                        <button 
                            onClick={() => downloadCsv(csvContent)}
                            className="mt-2 ml-1 flex items-center gap-1.5 text-xs font-medium bg-green-50 text-green-700 px-3 py-1.5 rounded-md border border-green-200 hover:bg-green-100 transition-colors shadow-sm"
                        >
                            <Download className="w-3 h-3" />
                            Download CSV
                        </button>
                    )}
                </div>
                {msg.role === 'user' && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                        <User className="w-5 h-5 text-slate-500" />
                    </div>
                )}
            </div>
          );
        })}
        {isLoading && (
            <div className="flex gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0 border border-blue-200">
                    <Bot className="w-5 h-5 text-blue-600" />
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm flex items-center">
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-white border-t">
        <div className="flex gap-2">
            <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Ask about the changes..."
                className="flex-1 border border-slate-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isLoading}
            />
            <button 
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="bg-blue-600 text-white rounded-lg p-2 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
                <Send className="w-5 h-5" />
            </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;