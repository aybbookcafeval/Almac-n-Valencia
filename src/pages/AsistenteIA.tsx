import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../lib/supabase';
import { cn } from '../lib/utils';

export default function AsistenteIA() {
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([
    { role: 'assistant', content: '¡Hola! Soy tu asistente de almacén y cocina. ¿En qué puedo ayudarte hoy con el inventario o las recetas?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = { role: 'user' as const, content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke('asisten-almacen', {
        body: { message: input, chatHistory: messages.slice(-5) },
      });

      if (error) {
        console.error("Function error details:", error);
        throw new Error(`Edge Function error: ${error.message || 'Unknown error'}`);
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
    } catch (e: any) {
      console.error("Caught error:", e);
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${e.message}. Por favor revisa la consola.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center">
        <div className="w-8 h-8 rounded-full bg-[#bf6849] flex items-center justify-center mr-3">
            <Bot className="text-white" size={20} />
        </div>
        <h2 className="font-bold text-gray-900">Asistente de Almacén IA</h2>
      </div>
      
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn("p-4 rounded-2xl max-w-[85%] text-sm", 
                m.role === 'user' 
                  ? 'bg-[#bf6849] text-white rounded-tr-none shadow-md shadow-[#bf6849]/10' 
                  : 'bg-zinc-100 text-gray-800 rounded-tl-none shadow-sm'
            )}>
              {m.role === 'user' ? (
                <div className="whitespace-pre-wrap">{m.content}</div>
              ) : (
                <div className="markdown-body space-y-1.5 break-words">
                  <ReactMarkdown
                    components={{
                      h1: ({ ...props }) => <h3 className="text-base font-bold text-black mt-2 mb-1" {...props} />,
                      h2: ({ ...props }) => <h4 className="text-sm font-bold text-black mt-2 mb-1" {...props} />,
                      h3: ({ ...props }) => <h5 className="text-xs font-bold text-black mt-1 mb-1" {...props} />,
                      p: ({ ...props }) => <p className="leading-relaxed mb-1.5 last:mb-0" {...props} />,
                      ul: ({ ...props }) => <ul className="list-disc pl-5 mb-2 space-y-1 text-gray-800" {...props} />,
                      ol: ({ ...props }) => <ol className="list-decimal pl-5 mb-2 space-y-1 text-gray-800" {...props} />,
                      li: ({ ...props }) => <li className="leading-relaxed" {...props} />,
                      table: ({ ...props }) => <div className="overflow-x-auto my-3 rounded-lg border border-gray-200 shadow-xs"><table className="min-w-full divide-y divide-gray-200 text-xs" {...props} /></div>,
                      thead: ({ ...props }) => <thead className="bg-[#bf6849] text-white" {...props} />,
                      tbody: ({ ...props }) => <tbody className="bg-white divide-y divide-gray-100" {...props} />,
                      tr: ({ ...props }) => <tr className="divide-x divide-gray-100 odd:bg-gray-50/50" {...props} />,
                      th: ({ ...props }) => <th className="px-3 py-1.5 text-left font-semibold text-white uppercase tracking-wider text-[10px]" {...props} />,
                      td: ({ ...props }) => <td className="px-3 py-1.5 text-gray-700" {...props} />,
                      code: ({ ...props }) => <code className="bg-zinc-200 text-zinc-900 rounded px-1 py-0.5 font-mono text-xs" {...props} />,
                      strong: ({ ...props }) => <strong className="font-semibold text-black" {...props} />,
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
            <div className="flex justify-start">
                <div className="p-3.5 rounded-2xl bg-zinc-100 text-gray-500 text-sm italic rounded-tl-none flex items-center gap-2 shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#bf6849] animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#bf6849] animate-bounce delay-150"></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-[#bf6849] animate-bounce delay-225"></span>
                    <span>Analizando información...</span>
                </div>
            </div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-gray-100">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Pregunta algo sobre inventario o recetas..."
            className="flex-1 h-10 px-4 border border-gray-200 rounded-full focus:border-[#bf6849] outline-none text-sm transition-colors"
          />
          <button 
            onClick={handleSend} 
            className="h-10 px-4 bg-black hover:bg-zinc-800 text-white rounded-full transition-colors flex items-center justify-center cursor-pointer" 
            disabled={isLoading}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
