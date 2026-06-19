import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';

const MAX_INSTRUCTIONS = 6;

type InstructionListEditorProps = {
  items: string[];
  onChange: (items: string[]) => void;
  primaryColor?: string;
};

function SortableRow({
  id,
  value,
  onChange,
  onRemove,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
    animation: 'instructionFadeIn 200ms ease-out',
  };

  return (
    <div ref={setNodeRef} style={style}>
      <span
        {...attributes}
        {...listeners}
        style={{ color: '#9ca3af', cursor: 'grab', userSelect: 'none', fontSize: 14, lineHeight: 1 }}
        title="Drag to reorder"
      >
        •
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          flex: 1,
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          padding: '8px 10px',
          fontSize: 13,
          outline: 'none',
        }}
      />
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove instruction"
        style={{
          border: 'none',
          background: 'transparent',
          cursor: 'pointer',
          color: '#9ca3af',
          padding: 4,
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

const InstructionListEditor: React.FC<InstructionListEditorProps> = ({ items, onChange }) => {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = items.map((_, i) => `instruction-${i}`);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    onChange(arrayMove(items, oldIndex, newIndex));
  };

  return (
    <div>
      <style>{`
        @keyframes instructionFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          {items.map((item, index) => (
            <SortableRow
              key={ids[index]}
              id={ids[index]}
              value={item}
              onChange={(v) => {
                const next = [...items];
                next[index] = v;
                onChange(next);
              }}
              onRemove={() => onChange(items.filter((_, i) => i !== index))}
            />
          ))}
        </SortableContext>
      </DndContext>
      {items.length < MAX_INSTRUCTIONS && (
        <button
          type="button"
          onClick={() => onChange([...items, ''])}
          style={{
            marginTop: 4,
            fontSize: 13,
            color: '#374151',
            background: 'transparent',
            border: '1px dashed #d1d5db',
            borderRadius: 6,
            padding: '8px 12px',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          + Add instruction
        </button>
      )}
    </div>
  );
};

export default InstructionListEditor;
