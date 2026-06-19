import React, { useEffect, useRef, useState } from 'react';
import { Lock, Pencil } from 'lucide-react';

const GRAY_LABEL = '#6b7280';

type InlineEditFieldProps = {
  value: string;
  onChange: (value: string) => void;
  editMode?: boolean;
  previewMode?: boolean;
  style?: React.CSSProperties;
  multiline?: boolean;
  placeholder?: string;
  primaryColor?: string;
};

const InlineEditField: React.FC<InlineEditFieldProps> = ({
  value,
  onChange,
  editMode = false,
  previewMode = false,
  style,
  multiline = false,
  placeholder = '',
  primaryColor = '#1a3a6b',
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [hover, setHover] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (!editing) return;
    if (multiline) {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    } else {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, multiline]);

  const isBlock = style?.display === 'block';
  const wrapperStyle: React.CSSProperties = {
    position: 'relative',
    display: isBlock ? 'block' : 'inline-block',
    width: isBlock ? (style?.width as string | number) || '100%' : undefined,
    maxWidth: isBlock ? '100%' : undefined,
    verticalAlign: 'top',
    ...style,
  };

  const commit = () => {
    setEditing(false);
    onChange(draft);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    background: 'transparent',
    border: 'none',
    borderBottom: `1.5px solid ${primaryColor}`,
    borderRadius: 0,
    fontSize: style?.fontSize,
    fontWeight: style?.fontWeight,
    fontStyle: style?.fontStyle,
    fontFamily: style?.fontFamily || 'inherit',
    color: style?.color,
    textTransform: style?.textTransform,
    letterSpacing: style?.letterSpacing,
    lineHeight: style?.lineHeight,
    textAlign: style?.textAlign,
    outline: 'none',
    padding: 0,
    margin: 0,
    resize: 'none',
    boxSizing: 'border-box',
  };

  if (!editMode || previewMode) {
    return <span style={{ ...wrapperStyle, cursor: previewMode ? 'default' : undefined }}>{value}</span>;
  }

  if (editing) {
    const shared = {
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !multiline) {
          e.preventDefault();
          commit();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          cancel();
        }
      },
      style: inputStyle,
    };
    return multiline ? (
      <textarea ref={textareaRef} {...shared} style={{ ...inputStyle, minHeight: 40 }} />
    ) : (
      <input ref={inputRef} type="text" {...shared} />
    );
  }

  return (
    <span
      role="button"
      tabIndex={0}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setEditing(true);
        }
      }}
      style={{
        ...wrapperStyle,
        cursor: 'text',
      }}
    >
      {value || placeholder}
      <Pencil
        size={11}
        style={{
          position: 'absolute',
          right: -2,
          top: 2,
          opacity: hover ? 0.5 : 0,
          color: GRAY_LABEL,
          pointerEvents: 'none',
        }}
      />
    </span>
  );
};

export function LockedField({
  children,
  style,
  previewMode = false,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
  previewMode?: boolean;
}) {
  const [hover, setHover] = useState(false);
  const [showTip, setShowTip] = useState(false);
  const tipTimer = useRef<number | null>(null);
  const isBlock = style?.display === 'block';

  if (previewMode) {
    return <span style={{ ...style, display: isBlock ? 'block' : 'inline-block', cursor: 'default' }}>{children}</span>;
  }

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowTip(true);
    if (tipTimer.current) window.clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(() => setShowTip(false), 1500);
  };

  useEffect(
    () => () => {
      if (tipTimer.current) window.clearTimeout(tipTimer.current);
    },
    []
  );

  return (
    <span
      style={{
        position: 'relative',
        display: isBlock ? 'block' : 'inline-block',
        cursor: 'not-allowed',
        ...style,
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={onClick}
    >
      {children}
      {hover && (
        <Lock
          size={11}
          style={{
            position: 'absolute',
            right: -2,
            top: 2,
            color: GRAY_LABEL,
            pointerEvents: 'none',
          }}
        />
      )}
      {showTip && (
        <span
          style={{
            position: 'absolute',
            left: 0,
            top: '100%',
            marginTop: 4,
            background: '#111827',
            color: '#ffffff',
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            zIndex: 20,
          }}
        >
          This field cannot be edited
        </span>
      )}
    </span>
  );
}

export default InlineEditField;
