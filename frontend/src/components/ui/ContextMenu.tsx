"use client";
import React, { useEffect, useRef, useState } from 'react';

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
  wrapperClassName?: string;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ items, children, wrapperClassName = 'inline-flex' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const x = e.clientX;
    const y = e.clientY;

    // Adjust position to keep menu in viewport
    const menuWidth = 180;
    const menuHeight = items.length * 40;

    const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
    const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

    setPosition({ x: adjustedX, y: adjustedY });
    setIsOpen(true);
  };

  return (
    <>
      <div onContextMenu={handleContextMenu} className={wrapperClassName}>
        {children}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          className="fixed z-50 min-w-[160px] py-1 rounded-xl glass border border-zinc-700/50 shadow-xl animate-fade-in"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`,
          }}
        >
          {items.map((item, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                if (!item.disabled) {
                  item.onClick();
                  setIsOpen(false);
                }
              }}
              disabled={item.disabled}
              className={`w-full px-4 py-2.5 text-sm text-left flex items-center gap-3 transition-colors ${
                item.disabled
                  ? 'text-zinc-600 cursor-not-allowed'
                  : item.danger
                  ? 'text-red-400 hover:bg-red-500/10'
                  : 'text-zinc-300 hover:bg-zinc-700/50'
              }`}
            >
              {item.icon && <span className="w-4 h-4">{item.icon}</span>}
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
};

export default ContextMenu;
