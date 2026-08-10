import React from 'react';
import { BoardingGuard } from './BoardingGuard';

interface BoardingModuleProps {
  onNavigate?: (module: string) => void;
  children: React.ReactNode;
}

/** @deprecated Prefer BoardingGuard — kept as alias for existing Dashboard imports. */
export const BoardingModule: React.FC<BoardingModuleProps> = ({ onNavigate, children }) => (
  <BoardingGuard onNavigate={onNavigate}>{children}</BoardingGuard>
);

export default BoardingModule;
