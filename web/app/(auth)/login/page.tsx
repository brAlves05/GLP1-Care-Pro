'use client';
import Link from 'next/link';
import { useState } from 'react';
import { Syringe, Eye, EyeOff, ShieldCheck, ChevronRight, Lock } from 'lucide-react';

export default function LoginPage() {
  const [step, setStep] = useState<'creds' | 'mfa'>('creds');
  const [showPw, setShowPw] = useState(false);
  const [code, setCode] = useState('');

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-violet-600/20 rounded-full blur-3xl" />
      </div>
      <div className="relative w-full max-w-md">
        <div className="bg-white rounded-3xl shadow-2xl shadow-black/30 overflow-hidden">
          {/* Header azul */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 pt-8 pb-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-white/20 flex items-center justify-center">
                <Syringe className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-lg leading-none">GLP-1 Care Pro</p>
                <p className="text-blue-200 text-xs mt-0.5">Plataforma Clínica</p>
              </div>
            </div>
            <h1 className="text-white text-2xl font-bold">
              {step === 'creds' ? 'Bem-vindo de volta' : 'Verificação em 2 etapas'}
            </h1>
            <p className="text-blue-200 text-sm mt-1">
              {step === 'creds' ? 'Acesse sua conta para continuar' : 'Código do seu autenticador TOTP'}
            </p>
          </div>

          <div className="px-8 py-8">
            {step === 'creds' ? (
              <form onSubmit={(e) => { e.preventDefault(); setStep('mfa'); }} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">E-mail</label>
                  <input type="email" defaultValue="rafael.costa@clinica.com.br" className="input" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Senha</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} defaultValue="senha-demo" className="input pr-11" />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex justify-end mt-1.5">
                    <a href="#" className="text-xs text-blue-600 hover:underline">Esqueceu a senha?</a>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full justify-center py-3">
                  Continuar <ChevronRight className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-xl">
                  <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <p className="text-xs text-blue-700">MFA obrigatório para médicos e nutricionistas (CFM/CFF)</p>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="flex justify-center py-2">
                  <div className="w-16 h-16 rounded-2xl bg-blue-100 flex items-center justify-center">
                    <Lock className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <p className="text-sm text-gray-600 text-center">
                  Código de 6 dígitos para <strong>rafael.costa@clinica.com.br</strong>
                </p>
                <div className="flex gap-2 justify-center">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <input key={i} type="text" maxLength={1} value={code[i] ?? ''}
                      onChange={(e) => {
                        const v = e.target.value.replace(/\D/g, '');
                        const arr = code.split('');
                        arr[i] = v;
                        setCode(arr.join('').slice(0, 6));
                      }}
                      className="w-11 h-12 text-center text-lg font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 transition" />
                  ))}
                </div>
                <Link href="/" className="btn-primary w-full justify-center py-3 block text-center">
                  Verificar e Acessar <ShieldCheck className="w-4 h-4" />
                </Link>
                <button onClick={() => setStep('creds')} className="w-full text-sm text-gray-500 hover:text-gray-700 text-center">
                  ← Voltar
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="text-center text-gray-500 text-xs mt-4">© 2025 GLP-1 Care Pro · Conformidade LGPD · CFM</p>
      </div>
    </div>
  );
}
