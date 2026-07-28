'use client';
import { useState } from 'react';
import { Send, Lock, ShieldCheck, Search, MoreVertical, Phone, Video } from 'lucide-react';
import { CONVERSATIONS } from '@/lib/mock-data';

const DEMO_MESSAGES: Record<string, { from: 'me' | 'them'; text: string; time: string }[]> = {
  conv_01: [
    { from: 'them', text: 'Dr. Rafael, bom dia! Queria relatar que sinto náusea desde ontem à tarde.', time: '08:12' },
    { from: 'me',   text: 'Bom dia, João. Obrigado por avisar. Qual a intensidade numa escala de 0 a 10?', time: '08:35' },
    { from: 'them', text: 'Está em uns 8, foi difícil comer ontem. Tomei o medicamento às 20h.', time: '09:01' },
    { from: 'me',   text: 'Entendido. Vou revisar seu check-in. Enquanto isso, evite alimentos gordurosos e beba bastante água. Se piorar, me avise imediatamente.', time: '09:15' },
    { from: 'them', text: 'Dr., a náusea piorou bastante ontem à noite. Consegui tomar...', time: '09:41' },
  ],
  conv_02: [
    { from: 'them', text: 'Boa tarde Dr. Rafael! Registrei o peso hoje: 88,4 kg.', time: 'ontem 16:20' },
    { from: 'them', text: 'Muito feliz com o progresso! Já perdi 9 kg desde o início.', time: 'ontem 16:21' },
    { from: 'me',   text: 'Parabéns, Maria! Resultado excelente. Vemos sua consulta semana que vem para avaliar o próximo escalonamento.', time: 'ontem 17:04' },
  ],
  conv_03: [
    { from: 'them', text: 'Oi Dr. Rafael! Atualizei o plano nutricional da Ana para a Fase 2.', time: 'ontem 13:30' },
    { from: 'them', text: 'Por favor, revisar antes da consulta de terça.', time: 'ontem 13:31' },
  ],
  conv_04: [
    { from: 'them', text: 'Dr., minha glicemia de jejum hoje deu 168. Preciso ajustar a insulina?', time: '14/04 07:45' },
    { from: 'me',   text: 'Carlos, vou analisar os dados. Não ajuste a insulina sem consultar-me primeiro. Marquei uma consulta rápida para amanhã.', time: '14/04 09:30' },
  ],
  conv_05: [
    { from: 'them', text: 'Dr. Rafael, precisei pausar o medicamento por causa de uma cirurgia.', time: '10/04 10:05' },
    { from: 'them', text: 'Quando posso retomar o tratamento?', time: '10/04 10:06' },
    { from: 'me',   text: 'Ana, pode retomar 2 semanas após a cirurgia, desde que sem complicações. Agende um retorno para avaliação.', time: '10/04 11:22' },
  ],
};

export default function MessagesPage() {
  const [active, setActive] = useState('conv_01');
  const [draft, setDraft] = useState('');

  const conv     = CONVERSATIONS.find((c) => c.id === active)!;
  const messages = DEMO_MESSAGES[active] ?? [];

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-80 flex-shrink-0 border-r border-gray-100 bg-white flex flex-col">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900 mb-3">Mensagens</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="search" placeholder="Buscar conversa..." className="input pl-9 text-xs" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {CONVERSATIONS.map((c) => (
            <button key={c.id} onClick={() => setActive(c.id)}
              className={`w-full p-4 flex items-start gap-3 text-left transition-colors hover:bg-gray-50/80 ${active === c.id ? 'bg-blue-50/60' : ''}`}>
              <div className={`w-10 h-10 rounded-full ${c.fromColor} flex items-center justify-center flex-shrink-0`}>
                <span className="text-white text-[11px] font-bold">{c.fromInitials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-gray-900 truncate">{c.from}</p>
                  <p className="text-[11px] text-gray-400 flex-shrink-0 ml-2">{c.time}</p>
                </div>
                <div className="flex items-center justify-between mt-0.5">
                  <p className="text-xs text-gray-500 truncate pr-2">{c.preview}</p>
                  {c.unread > 0 && (
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-bold flex items-center justify-center">
                      {c.unread}
                    </span>
                  )}
                </div>
                {!c.isPatient && (
                  <span className="inline-flex items-center gap-1 text-[10px] text-teal-600 font-medium mt-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" /> Profissional
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col bg-gray-50/40 min-w-0">
        {/* Chat header */}
        <div className="flex-shrink-0 h-16 bg-white border-b border-gray-100 px-5 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-full ${conv.fromColor} flex items-center justify-center flex-shrink-0`}>
            <span className="text-white text-[11px] font-bold">{conv.fromInitials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900">{conv.from}</p>
            <p className="text-xs text-gray-400">{conv.isPatient ? 'Paciente' : 'Profissional de saúde'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
              <Phone className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
              <Video className="w-4 h-4" />
            </button>
            <button className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center text-gray-400 transition">
              <MoreVertical className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* E2E notice */}
        <div className="mx-auto mt-4 flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded-full px-4 py-1.5">
          <Lock className="w-3 h-3 text-emerald-600" />
          <p className="text-[11px] text-emerald-700 font-medium">Mensagens criptografadas ponta a ponta — conforme LGPD</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-4 py-2.5 rounded-2xl text-sm shadow-sm
                ${msg.from === 'me'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-white text-gray-800 rounded-bl-sm border border-gray-100'}`}>
                <p>{msg.text}</p>
                <p className={`text-[11px] mt-1 ${msg.from === 'me' ? 'text-blue-200' : 'text-gray-400'} text-right`}>
                  {msg.time}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className="flex-shrink-0 p-4 bg-white border-t border-gray-100">
          <form className="flex items-end gap-3"
            onSubmit={(e) => { e.preventDefault(); setDraft(''); }}>
            <div className="flex-1 bg-gray-50 border border-gray-200 rounded-2xl px-4 py-2.5 focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-400 transition">
              <textarea
                rows={1}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Escreva sua mensagem..."
                className="w-full bg-transparent text-sm text-gray-800 placeholder-gray-400 resize-none focus:outline-none"
              />
            </div>
            <button type="submit"
              disabled={!draft.trim()}
              className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition flex-shrink-0">
              <Send className="w-4 h-4 text-white" />
            </button>
          </form>
          <div className="flex items-center gap-1.5 mt-2">
            <Lock className="w-2.5 h-2.5 text-gray-400" />
            <p className="text-[10px] text-gray-400">Criptografado ponta a ponta · LGPD Art. 46</p>
          </div>
        </div>
      </div>
    </div>
  );
}
