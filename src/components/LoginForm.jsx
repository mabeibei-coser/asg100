import React, { useState, useEffect, useRef } from 'react';
import { Box, Typography, TextField, Button, Alert, Stack } from '@mui/material';
import LoginIcon from '@mui/icons-material/Login';
import { sendSmsCode, verifySmsCode } from '../utils/api';

const PHONE_RE = /^1\d{10}$/;

/**
 * 手机号 + 短信验证码登录卡片。
 * 流程：输手机号 → 获取验证码（60s 倒计时）→ 输 6 位码 → 登录。
 * 登录成功后回调 onLoggedIn({ userId, phone })，由父组件刷新页面状态。
 */
export default function LoginForm({ onLoggedIn }) {
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const timerRef = useRef(null);

  const phoneValid = PHONE_RE.test(phone);
  const codeValid = /^\d{6}$/.test(code);

  useEffect(() => () => clearInterval(timerRef.current), []);

  const startCountdown = () => {
    setCountdown(60);
    timerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  };

  const handleSend = async () => {
    if (!phoneValid || sending || countdown > 0) return;
    setSending(true);
    setError(null);
    setInfo(null);
    try {
      const data = await sendSmsCode(phone);
      startCountdown();
      setInfo(
        data.dev
          ? '开发模式：验证码未真实发送，请使用主验证码登录'
          : '验证码已发送，请查收短信'
      );
    } catch (err) {
      setError(err.message || '验证码发送失败');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phoneValid || !codeValid || loading) return;
    setLoading(true);
    setError(null);
    try {
      const data = await verifySmsCode(phone, code);
      onLoggedIn?.(data);
    } catch (err) {
      setError(err.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      component="form"
      onSubmit={handleSubmit}
      className="glass-card"
      sx={{
        maxWidth: 420,
        mx: 'auto',
        p: { xs: 3, md: 4 },
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e3a5f', mb: 0.5 }}>
          手机号登录
        </Typography>
        <Typography variant="body2" sx={{ color: '#64748b', fontSize: '0.85rem' }}>
          输入手机号获取验证码，登录后即可使用隐患识别，识别记录自动保存到你的账号
        </Typography>
      </Box>

      <TextField
        label="手机号"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 11))}
        disabled={loading}
        placeholder="请输入 11 位手机号"
        inputMode="numeric"
        autoComplete="tel"
        fullWidth
        error={Boolean(phone) && !phoneValid}
        helperText={phone && !phoneValid ? '手机号格式不正确（应为 1 开头 11 位）' : ' '}
      />

      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          label="验证码"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={loading}
          placeholder="6 位验证码"
          inputMode="numeric"
          autoComplete="one-time-code"
          fullWidth
          helperText=" "
        />
        <Button
          onClick={handleSend}
          disabled={!phoneValid || sending || countdown > 0}
          variant="outlined"
          sx={{
            mt: 0.25,
            minWidth: 124,
            py: 1.85,
            whiteSpace: 'nowrap',
            color: '#1e3a5f',
            borderColor: 'rgba(30,58,95,0.5)',
            '&:hover': { borderColor: '#1e3a5f', background: 'rgba(30,58,95,0.04)' },
          }}
        >
          {countdown > 0 ? `${countdown}s 后重发` : sending ? '发送中...' : '获取验证码'}
        </Button>
      </Stack>

      {info && <Alert severity="info">{info}</Alert>}
      {error && <Alert severity="error">{error}</Alert>}

      <Button
        type="submit"
        variant="contained"
        disabled={!phoneValid || !codeValid || loading}
        startIcon={loading ? null : <LoginIcon />}
        sx={{
          py: 1.5,
          background: phoneValid && codeValid && !loading ? '#1e3a5f' : 'rgba(0,0,0,0.04)',
          color: phoneValid && codeValid && !loading ? '#fff' : 'rgba(0,0,0,0.26)',
          '&:hover': {
            background: phoneValid && codeValid && !loading ? '#2c5282' : 'rgba(0,0,0,0.04)',
          },
          '&.Mui-disabled': {
            color: 'rgba(0,0,0,0.26)',
            background: 'rgba(0,0,0,0.04)',
          },
        }}
      >
        {loading ? '登录中...' : '登录'}
      </Button>

      <Typography variant="caption" sx={{ color: '#94a3b8', textAlign: 'center' }}>
        未注册的手机号将在验证通过后自动创建账号
      </Typography>
    </Box>
  );
}
