import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { useState } from 'react';
import { EmptyState, PageHead, useShell } from '../../components/AppShell';
import { Countdown } from '../../components/Bits';
import { IconTrophy } from '../../components/Icons';
import { useHackathons, useSaveHackathon } from '../../lib/hooks';
import { formatRange } from '../../lib/time';
import { STATUSES, STATUS_LABEL, type Hackathon, type Status } from '../../lib/types';

function CardBody({ h }: { h: Hackathon }) {
  const open = h.submissionDeadline && h.status !== 'SUBMITTED' && h.status !== 'DONE';
  return (
    <>
      <strong>{h.name}</strong>
      <span className="card-meta">{formatRange(h.startDate, h.endDate)}</span>
      {h.projectName && <span className="card-project">{h.projectName}</span>}
      {open && <Countdown iso={h.submissionDeadline as string} prefix="Closes in" />}
      {h.won && <span className="win-badge"><IconTrophy />{h.placement ?? 'Won'}</span>}
      {h.techStack.length > 0 && (
        <span className="chips">
          {h.techStack.slice(0, 3).map((t) => <span className="chip" key={t}>{t}</span>)}
          {h.techStack.length > 3 && <span className="chip">+{h.techStack.length - 3}</span>}
        </span>
      )}
    </>
  );
}

function Card({ h, onOpen }: { h: Hackathon; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: h.id });
  return (
    <button
      type="button"
      ref={setNodeRef}
      className={`card${isDragging ? ' is-dragging' : ''}`}
      onClick={onOpen}
      {...listeners}
      {...attributes}
    >
      <CardBody h={h} />
    </button>
  );
}

function Column({ status, items, onOpen }: { status: Status; items: Hackathon[]; onOpen: (h: Hackathon) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <section ref={setNodeRef} className={`column${isOver ? ' is-over' : ''}`} aria-label={STATUS_LABEL[status]}>
      <header>
        <span className={`dot dot-${status.toLowerCase()}`} />
        {STATUS_LABEL[status]}
        <b>{items.length}</b>
      </header>
      {items.map((h) => <Card key={h.id} h={h} onOpen={() => onOpen(h)} />)}
      {!items.length && <p className="column-empty">Drop a card here</p>}
    </section>
  );
}

export function BoardPage() {
  const { openEditor } = useShell();
  const query = useHackathons();
  const save = useSaveHackathon();
  const [activeId, setActiveId] = useState<string | null>(null);
  // A small drag distance keeps a plain click free to open the card.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const list = query.data ?? [];

  if (query.isPending) return <div className="page-loading" role="status">Loading your board</div>;
  if (query.isError) return <div className="page-error" role="alert">{query.error.message}</div>;

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const target = event.over?.id as Status | undefined;
    const card = list.find((h) => h.id === event.active.id);
    if (!target || !card || card.status === target) return;
    const lastPosition = Math.max(0, ...list.filter((h) => h.status === target).map((h) => h.position));
    save.mutate({ id: card.id, input: { status: target, position: lastPosition + 1 } });
  };

  const active = list.find((h) => h.id === activeId);

  return (
    <>
      <PageHead title="Board" sub="Drag a card to change its status. Click a card to edit it." />
      {save.isError && <p className="form-error" role="alert">That move was not saved. {save.error.message}</p>}
      {!list.length ? (
        <EmptyState onAdd={() => openEditor()} />
      ) : (
        <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="board">
            {STATUSES.map((s) => (
              <Column
                key={s}
                status={s}
                items={list.filter((h) => h.status === s).sort((a, b) => a.position - b.position)}
                onOpen={openEditor}
              />
            ))}
          </div>
          <DragOverlay>{active && <div className="card card-overlay"><CardBody h={active} /></div>}</DragOverlay>
        </DndContext>
      )}
    </>
  );
}
