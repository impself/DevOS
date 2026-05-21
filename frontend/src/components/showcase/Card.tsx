import { type ReactNode } from 'react';
import styled from 'styled-components';

interface CardProps {
  title: string;
  description?: string;
  meta?: string;
  progress?: { done: number; total: number };
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
  children?: ReactNode;
}

const GlassCard = styled.div`
  position: relative;
  padding: 24px;
  border-radius: 16px;
  display: flex;
  flex-direction: column;
  cursor: pointer;
  min-height: 168px;
  overflow: hidden;
  isolation: isolate;

  /* Frosted glass background */
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.06);

  /* Multi-layer ambient shadow */
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.03) inset,
    0 1px 2px rgba(0, 0, 0, 0.12),
    0 4px 12px rgba(0, 0, 0, 0.08);

  /* Top-edge light catch */
  &::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    padding: 1px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.08) 0%,
      transparent 40%
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
  }

  /* Hover ambient glow */
  &::after {
    content: '';
    position: absolute;
    top: -50%;
    left: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(
      circle at 50% 50%,
      rgba(120, 119, 255, 0.04) 0%,
      transparent 60%
    );
    opacity: 0;
    transition: opacity 0.5s ease;
    pointer-events: none;
    z-index: -1;
  }

  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);

  &:hover {
    transform: translateY(-2px);
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.05) inset,
      0 2px 4px rgba(0, 0, 0, 0.08),
      0 8px 24px rgba(0, 0, 0, 0.12),
      0 16px 48px rgba(0, 0, 0, 0.06);

    &::after { opacity: 1; }
  }

  &:active {
    transform: translateY(0);
    transition-duration: 0.1s;
  }

  /* --- Inner elements --- */

  .card-title {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: -0.01em;
    padding-right: 40px;
    line-height: 1.4;
    color: var(--foreground, #f0f0f0);
  }

  .card-desc {
    font-size: 13px;
    line-height: 1.6;
    margin-top: 8px;
    color: var(--muted-foreground, #888);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-meta {
    font-size: 11px;
    letter-spacing: 0.02em;
    color: var(--muted-foreground, #666);
    margin-top: auto;
    padding-top: 16px;
  }

  .card-progress { margin-top: 14px; }

  .progress-header {
    display: flex;
    justify-content: space-between;
    font-size: 11px;
    letter-spacing: 0.01em;
    color: var(--muted-foreground, #666);
    margin-bottom: 8px;
  }

  .progress-track {
    height: 3px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 50em;
    overflow: hidden;
  }

  .progress-fill {
    height: 100%;
    border-radius: 50em;
    background: linear-gradient(90deg, #7877ff, #a78bfa);
    transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .card-actions {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.25s ease;
  }

  &:hover .card-actions { opacity: 1; }

  .action-btn {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--muted-foreground, #666);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;

    &:hover {
      background: rgba(255, 255, 255, 0.06);
      color: var(--foreground, #f0f0f0);
    }

    &.danger:hover {
      background: rgba(239, 68, 68, 0.08);
      color: #f87171;
    }
  }
`;

const ShowcaseCard = ({
  title,
  description,
  meta,
  progress,
  actions,
  onClick,
  className,
  children,
}: CardProps) => (
  <GlassCard onClick={onClick} className={className}>
    {actions && <div className="card-actions">{actions}</div>}
    <div className="card-title">{title}</div>
    {description && <div className="card-desc">{description}</div>}
    {progress && (
      <div className="card-progress">
        <div className="progress-header">
          <span>{progress.done} / {progress.total}</span>
          <span>{Math.round((progress.done / progress.total) * 100)}%</span>
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${(progress.done / progress.total) * 100}%` }}
          />
        </div>
      </div>
    )}
    {meta && <div className="card-meta">{meta}</div>}
    {children}
  </GlassCard>
);

export default ShowcaseCard;
