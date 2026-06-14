import React from 'react';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/**
 * 统一页眉：延续首页标题语言 —— 小标签(eyebrow) + 大标题 + 发光渐变下划线。
 * 贯穿 ASG100 / A600 / A800 所有内页的签名元素（源自「ASG 统一设计原型」）。
 * 只做视觉，不改任何业务内容：title/action 由各页原样传入。
 */
export default function PageHead({ eyebrow, eyebrowIcon, title, action, onBack }) {
  return (
    <div className="page-head">
      {onBack && (
        <button type="button" className="page-head-back" onClick={onBack} aria-label="返回">
          <ArrowBackIcon sx={{ fontSize: 18 }} />
        </button>
      )}
      <div className="page-head-main">
        {eyebrow && (
          <div className="page-head-eyebrow">
            {eyebrowIcon}
            {eyebrow}
          </div>
        )}
        <div className="page-head-title">{title}</div>
        <div className="page-head-line" />
      </div>
      {action && <div className="page-head-action">{action}</div>}
    </div>
  );
}
