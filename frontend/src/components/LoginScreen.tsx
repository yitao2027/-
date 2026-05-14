import React, { useState, useEffect, useRef } from 'react';
import { getVersion } from '@tauri-apps/api/app';
import { sendSmsCode, loginWithCode, setJwtToken } from '../services/pointsApi';
import { VALID_INVITE_CODES, INVITE_CODE_PATTERN } from '../data/INVITE_CODES';

interface LoginScreenProps {
  onLogin: () => void;
}

// 🔑 有效邀请码集合（v5.5.20：500 个 11 位带校验码，从 INVITE_CODES.ts 加载）
const VALID_CODE_SET = new Set<string>(VALID_INVITE_CODES);

export default function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [codeStatus, setCodeStatus] = useState<'idle'|'valid'|'invalid'>('idle');
  const [appVersion, setAppVersion] = useState('');
  const [loginMode, setLoginMode] = useState<'invite' | 'phone'>('invite');

  // 手机号登录状态
  const [phone, setPhone] = useState('');
  const [smsCode, setSmsCode] = useState('');
  const [codeCountdown, setCodeCountdown] = useState(0);
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [debugCode, setDebugCode] = useState('');
  const countdownRef = useRef<any>(null);

  useEffect(() => {
    getVersion().then(v => setAppVersion(v)).catch(() => {});
  }, []);

  // 启动时检查是否已绑定过邀请码
  useEffect(() => {
    const redeemed = localStorage.getItem('shaoziclaw_invite_verified');
    if (redeemed === 'true') {
      setInviteCode(localStorage.getItem('shaoziclaw_invite_code') || '');
      setCodeStatus('valid');
    }
  }, []);

  // 实时校验邀请码（前端即时反馈，11 位带校验码）
  useEffect(() => {
    if (!inviteCode || inviteCode.trim().length < 11) {
      setCodeStatus('idle');
      return;
    }
    const upper = inviteCode.trim().toUpperCase();
    if (INVITE_CODE_PATTERN.test(upper) && VALID_CODE_SET.has(upper)) {
      setCodeStatus('valid');
    } else {
      setCodeStatus('invalid');
    }
  }, [inviteCode]);

  // 清理倒计时
  useEffect(() => {
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, []);

  // 发送验证码
  const handleSendCode = async () => {
    if (!phone || phone.length !== 11) { setError('请输入11位手机号'); return; }
    setPhoneLoading(true);
    setError('');
    try {
      const res = await sendSmsCode(phone);
      // debug 模式：验证码在响应中
      if (res.debugCode) {
        setDebugCode(res.debugCode);
        console.log('[LoginScreen] debug验证码:', res.debugCode);
      }
      // 60秒倒计时
      setCodeCountdown(60);
      countdownRef.current = setInterval(() => {
        setCodeCountdown(prev => {
          if (prev <= 1) { clearInterval(countdownRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (e: any) {
      setError(`发送验证码失败: ${e.message}`);
    } finally {
      setPhoneLoading(false);
    }
  };

  // 手机号验证码登录
  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length !== 11) { setError('请输入11位手机号'); return; }
    if (!smsCode || smsCode.length < 4) { setError('请输入验证码'); return; }
    if (!agreed) { setError('请先阅读并同意用户协议'); return; }

    setPhoneLoading(true);
    setError('');
    try {
      const res = await loginWithCode(phone, smsCode);
      setJwtToken(res.token);
      setPhoneLoading(false);
      onLogin();
    } catch (e: any) {
      setPhoneLoading(false);
      setError(`登录失败: ${e.message}`);
    }
  };

  // 邀请码登录
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // 校验必填项
    if (!email) { setError('请输入邮箱地址'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('请输入有效的邮箱地址'); return; }
    if (!password) { setError('请输入密码'); return; }
    if (!inviteCode || inviteCode.trim().length !== 11) { setError('请输入 11 位邀请码（必填）'); return; }
    if (!agreed) { setError('请先阅读并同意用户协议'); return; }
    
    // 校验邀请码
    const code = inviteCode.trim().toUpperCase();
    if (!INVITE_CODE_PATTERN.test(code) || !VALID_CODE_SET.has(code)) {
      setError('邀请码无效，请联系发放人获取正确邀请码');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // 调用后端登录（含邀请码）
      const { invoke } = await import('@tauri-apps/api/core');
      
      try {
        await invoke('login', { email, password });
      } catch {
        // 后端没有用户则自动注册
        try {
          await invoke('register', { email, password, name: email.split('@')[0] });
        } catch (regErr) {
          // 可能已注册，忽略继续
          console.warn('[LoginScreen] 注册结果:', regErr);
        }
      }

      // ✅ 邀请码验证通过 → 存储绑定状态
      localStorage.setItem('shaoziclaw_invite_verified', 'true');
      localStorage.setItem('shaoziclaw_invite_code', code);
      
      setLoading(false);
      onLogin();
    } catch (err) {
      setLoading(false);
      setError(`登录失败: ${err}`);
    }
  };

  // ==================== 登录页（含邀请码） ====================
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden"
         style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0f0f23 100%)' }}>
        
        {/* 背景装饰 */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20"
               style={{ background: 'radial-gradient(circle, #57CC86 0%, transparent 70%)', filter: 'blur(60px)' }} />
          <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-10"
               style={{ background: 'radial-gradient(circle, #57CC86 0%, transparent 70%)', filter: 'blur(40px)' }} />
          <div className="absolute inset-0 opacity-[0.03]"
               style={{
                 backgroundImage: `linear-gradient(rgba(87,204,134,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(87,204,134,0.3) 1px, transparent 1px)`,
                 backgroundSize: '60px 60px'
               }} />
        </div>

        <div className="relative z-10 w-full max-w-md mx-4">
          {/* Logo区域 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 relative"
                 style={{ background: '#ffffff', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <img src="/logo-favicon.png" alt="勺子Claw" style={{width:52,height:52,objectFit:'contain'}} />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight mb-1">勺子Claw</h1>
            <p className="text-sm text-gray-500 tracking-wide uppercase">餐饮人的超级AI大脑</p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full"
                 style={{ background: 'rgba(87,204,134,0.08)', border: '1px solid rgba(87,204,134,0.15)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-[#57CC86]/80 font-medium">v{appVersion || '...'} · 邀请制内测</span>
            </div>
          </div>

          {/* 登录卡片 */}
          <div className="rounded-2xl p-7 backdrop-blur-xl"
               style={{
                 background: 'rgba(255,255,255,0.03)',
                 border: '1px solid rgba(255,255,255,0.06)',
                 boxShadow: '0 20px 60px rgba(0,0,0,0.4)'
               }}>
            
            <div className="mb-5">
              <h2 className="text-lg font-semibold text-white mb-0.5">登录 / 注册</h2>
              <p className="text-xs text-gray-500">输入邀请码开启餐饮人的超级AI大脑</p>
            </div>

            {/* ═══ 登录方式 Tab 切换（v5.5.23 暂时隐藏：等后端 api.shaoziclaw.com 短信通道上线后再放开）═══ */}
            {/*
            <div className="flex gap-1 mb-5 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)' }}>
              <button type="button" onClick={() => { setLoginMode('invite'); setError(''); }}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${loginMode === 'invite' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                style={loginMode === 'invite' ? { background: 'rgba(87,204,134,0.15)', color: '#57CC86' } : {}}>
                邀请码登录
              </button>
              <button type="button" onClick={() => { setLoginMode('phone'); setError(''); }}
                className={`flex-1 py-2 rounded-md text-xs font-medium transition-all ${loginMode === 'phone' ? 'text-white' : 'text-gray-500 hover:text-gray-300'}`}
                style={loginMode === 'phone' ? { background: 'rgba(87,204,134,0.15)', color: '#57CC86' } : {}}>
                手机号登录
              </button>
            </div>
            */}

            {/* ═══ 手机号登录表单（v5.5.23 暂时禁用：依赖后端短信通道）═══ */}
            {false && loginMode === 'phone' && (
              <form onSubmit={handlePhoneLogin} className="space-y-3.5">
                {/* 手机号 */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">手机号</label>
                  <input
                    type="tel" maxLength={11}
                    value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="请输入11位手机号"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#57CC86]/40 focus:bg-white/[0.06] transition-all duration-200"
                  />
                </div>
                {/* 验证码 */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">验证码</label>
                  <div className="flex gap-2">
                    <input
                      type="text" maxLength={6}
                      value={smsCode} onChange={(e) => setSmsCode(e.target.value)}
                      placeholder="6位验证码"
                      className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm tracking-widest text-center placeholder-gray-600 focus:outline-none focus:border-[#57CC86]/40 transition-all duration-200"
                    />
                    <button type="button" onClick={handleSendCode} disabled={codeCountdown > 0 || phoneLoading}
                      className="px-4 py-2.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all disabled:opacity-40"
                      style={{ background: codeCountdown > 0 ? '#333' : 'rgba(87,204,134,0.15)', color: '#57CC86', border: '1px solid rgba(87,204,134,0.2)' }}>
                      {codeCountdown > 0 ? `${codeCountdown}s` : '发送验证码'}
                    </button>
                  </div>
                  {debugCode && (
                    <p className="text-[11px] text-yellow-400 mt-1 ml-1">测试验证码: {debugCode}</p>
                  )}
                </div>
                {/* 错误提示 */}
                {error && (
                  <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                    <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <span className="text-xs text-red-400 leading-relaxed">{error}</span>
                  </div>
                )}
                {/* 协议 */}
                <div className="flex items-center pt-0.5">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${agreed ? 'bg-[#57CC86] border-[#57CC86]' : 'border-gray-600 group-hover:border-gray-400'}`}
                         onClick={() => setAgreed(!agreed)}>
                      {agreed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <span className="text-xs text-gray-400">我已阅读并同意<span className="text-[#57CC86]/70"> 用户协议</span>和<span className="text-[#57CC86]/70"> 隐私政策</span></span>
                  </label>
                </div>
                {/* 登录按钮 */}
                <button type="submit" disabled={phoneLoading || !agreed || phone.length !== 11 || smsCode.length < 4}
                  className="w-full py-3 rounded-xl font-semibold text-sm text-black transition-all duration-200 disabled:opacity-40 hover:shadow-lg active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #57CC86 0%, #3DAA5F 100%)', boxShadow: '0 4px 20px rgba(87,204,134,0.25)' }}>
                  {phoneLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                      登录中...
                    </span>
                  ) : '手机号登录'}
                </button>
              </form>
            )}

            {/* ═══ 邀请码登录表单（原有，不变）═══ */}
            {loginMode === 'invite' && (
            <form onSubmit={handleLogin} className="space-y-3.5">
              {/* 邮箱 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">邮箱地址</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#57CC]/40 focus:bg-white/[0.06] transition-all duration-200"
                  />
                </div>
              </div>

              {/* 密码 */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">密码</label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="设置密码"
                    className="w-full pl-10 pr-11 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#57CC]/40 focus:bg-white/[0.06] transition-all duration-200"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>
              </div>

              {/* 🔑 邀请码（必填） */}
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1 ml-1">
                  🔑 邀请码 <span className="text-red-400">*</span> <span className="text-gray-600 font-normal">（必填）</span>
                </label>
                <div className="relative">
                  <div className={`absolute left-3 top-1/2 -translate-y-1/2 ${codeStatus === 'valid' ? 'text-green-400' : codeStatus === 'invalid' ? 'text-red-400' : 'text-gray-500'}`}>
                    {codeStatus === 'valid' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : codeStatus === 'invalid' ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>
                      </svg>
                    )}
                  </div>
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    placeholder="请输入 11 位邀请码"
                    maxLength={11}
                    className={`w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/[0.04] text-sm tracking-wider uppercase font-mono text-center placeholder:text-gray-600 focus:outline-none transition-all duration-200 ${
                      codeStatus === 'valid'
                        ? 'border-green-500/50 bg-green-500/[0.04] text-green-300'
                        : codeStatus === 'invalid'
                        ? 'border-red-500/50 bg-red-500/[0.04]'
                        : 'border-white/[0.08] text-white focus:border-[#57CC]/40 focus:bg-white/[0.06]'
                    }`}
                    autoComplete="off"
                  />
                </div>
                {codeStatus === 'valid' && (
                  <p className="text-[11px] text-green-400 mt-1 ml-1 flex items-center gap-1">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    邀请码有效
                  </p>
                )}
                {inviteCode && inviteCode.length >= 11 && codeStatus === 'invalid' && (
                  <p className="text-[11px] text-red-400 mt-1 ml-1">邀请码无效，请联系发放人获取正确邀请码</p>
                )}
                {(!inviteCode || inviteCode.length < 11) && (
                  <p className="text-[11px] text-gray-600 mt-1 ml-1">
                    没有邀请码？发送邮件至 <button type="button" className="text-[#57CC86]/70 hover:text-[#57CC86]" onClick={() => window.open('mailto:songxuan@shaoziclaw.com?subject=勺子Claw邀请码申请', '_blank')}>songxuan@shaoziclaw.com</button> 申请
                  </p>
                )}
              </div>

              {/* 错误提示 */}
              {error && (
                <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
                  <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span className="text-xs text-red-400 leading-relaxed">{error}</span>
                </div>
              )}

              {/* 协议勾选 */}
              <div className="flex items-center pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-4 h-4 rounded-md border flex items-center justify-center transition-all ${agreed ? 'bg-[#57CC86] border-[#57CC86]' : 'border-gray-600 group-hover:border-gray-400'}`}
                       onClick={() => setAgreed(!agreed)}>
                    {agreed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#0a0a0a" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                  </div>
                  <span className="text-xs text-gray-400">我已阅读并同意<span className="text-[#57CC86]/70 hover:text-[#57CC86] cursor-pointer"> 用户协议</span>和<span className="text-[#57CC86]/70 hover:text-[#57CC86] cursor-pointer"> 隐私政策</span></span>
                </label>
              </div>

              {/* 登录按钮 */}
              <button
                type="submit"
                disabled={loading || !agreed || codeStatus === 'invalid' || !inviteCode.trim()}
                className="w-full py-3 rounded-xl font-semibold text-sm text-black transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
                style={{
                  background: loading || codeStatus !== 'valid' ? '#555' : 'linear-gradient(135deg, #57CC86 0%, #3DAA5F 100%)',
                  boxShadow: loading || codeStatus !== 'valid' ? 'none' : '0 4px 20px rgba(87,204,134,0.25)'
                }}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                    </svg>
                    验证中...
                  </span>
                ) : codeStatus === 'valid' ? '进入 勺子Claw' : '登 录'}
              </button>
            </form>
            )}

            {/* 分割线 + 提示 */}
            <div className="mt-5 pt-4 border-t border-white/[0.05]">
              <p className="text-[11px] text-gray-600 text-center flex items-center justify-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                邀请制内测 · 仅限受邀用户使用
              </p>
            </div>
          </div>

          {/* 底部版权 */}
          <p className="text-center text-[11px] text-gray-600 mt-5">
            © 2026 向上大树（北京）科技有限公司
          </p>
        </div>
      </div>
    );
}
