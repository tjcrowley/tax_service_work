import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  PIPELINE_LABELS,
  PIPELINE_STAGES,
  fetchContacts,
  fetchUsers,
  updateContact,
  type Contact,
  type PipelineStage,
} from '../lib/contacts';
import { daysSince, formatCurrency, initials } from '../lib/format';

export default function Pipeline() {
  const qc = useQueryClient();
  const usersQuery = useQuery({ queryKey: ['users'], queryFn: fetchUsers });
  const contactsQuery = useQuery({
    queryKey: ['contacts', { all: true }],
    queryFn: () => fetchContacts({ page: 1, limit: 100 }),
  });

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    usersQuery.data?.forEach((u) => map.set(u.id, u.name));
    return map;
  }, [usersQuery.data]);

  const grouped = useMemo(() => {
    const groups: Record<PipelineStage, Contact[]> = {
      new: [],
      contacted: [],
      qualified: [],
      proposal: [],
      negotiating: [],
      resolution: [],
      closed: [],
    };
    contactsQuery.data?.data.forEach((c) => {
      if (c.pipelineStage && c.pipelineStage in groups) {
        groups[c.pipelineStage].push(c);
      }
    });
    return groups;
  }, [contactsQuery.data]);

  const mutation = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: PipelineStage }) =>
      updateContact(id, { pipelineStage: stage }),
    onMutate: async ({ id, stage }) => {
      await qc.cancelQueries({ queryKey: ['contacts'] });
      const previous = qc.getQueryData<Awaited<ReturnType<typeof fetchContacts>>>([
        'contacts',
        { all: true },
      ]);
      if (previous) {
        qc.setQueryData(['contacts', { all: true }], {
          ...previous,
          data: previous.data.map((c) => (c.id === id ? { ...c, pipelineStage: stage } : c)),
        });
      }
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(['contacts', { all: true }], ctx.previous);
      }
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const onDragEnd = (e: DragEndEvent) => {
    const id = e.active.id as string;
    const overId = e.over?.id as PipelineStage | undefined;
    if (!overId) return;
    const contact = contactsQuery.data?.data.find((c) => c.id === id);
    if (!contact || contact.pipelineStage === overId) return;
    mutation.mutate({ id, stage: overId });
  };

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-2xl font-semibold text-slate-900 mb-4">Pipeline</h1>

      <DndContext sensors={sensors} onDragEnd={onDragEnd}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {PIPELINE_STAGES.map((stage) => (
            <Column
              key={stage}
              stage={stage}
              cards={grouped[stage]}
              userMap={userMap}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({
  stage,
  cards,
  userMap,
}: {
  stage: PipelineStage;
  cards: Contact[];
  userMap: Map<string, string>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const total = cards.reduce((sum, c) => sum + Number(c.taxDebtAmount ?? 0), 0);

  return (
    <div
      ref={setNodeRef}
      className={`w-72 flex-shrink-0 rounded-lg border ${
        isOver ? 'bg-brand-50 border-brand-300' : 'bg-slate-100 border-slate-200'
      } flex flex-col max-h-[calc(100vh-180px)]`}
    >
      <div className="px-3 py-2 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-800 text-sm">{PIPELINE_LABELS[stage]}</span>
          <span className="text-xs text-slate-500">{cards.length}</span>
        </div>
        <div className="text-xs text-slate-500 tabular-nums">{formatCurrency(total)}</div>
      </div>
      <div className="p-2 space-y-2 overflow-y-auto flex-1">
        {cards.length === 0 && (
          <div className="text-xs text-slate-400 text-center py-4">No contacts</div>
        )}
        {cards.map((c) => (
          <Card key={c.id} contact={c} userMap={userMap} />
        ))}
      </div>
    </div>
  );
}

function Card({ contact, userMap }: { contact: Contact; userMap: Map<string, string> }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: contact.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;
  const agentName = contact.assignedTo ? userMap.get(contact.assignedTo) : null;
  const days = daysSince(contact.updatedAt);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`rounded-md bg-white border border-slate-200 p-3 shadow-sm cursor-grab active:cursor-grabbing ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <Link
        to={`/contacts/${contact.id}`}
        onClick={(e) => e.stopPropagation()}
        className="font-medium text-sm text-slate-900 hover:text-brand-700"
      >
        {contact.firstName} {contact.lastName}
      </Link>
      <div className="text-xs text-slate-500 mt-0.5">{contact.phone}</div>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-semibold text-slate-700 tabular-nums">
          {formatCurrency(contact.taxDebtAmount)}
        </span>
        {agentName && (
          <span
            title={agentName}
            className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-[10px] font-semibold"
          >
            {initials(agentName)}
          </span>
        )}
      </div>
      {days !== null && (
        <div className="text-[11px] text-slate-400 mt-1">{days}d since activity</div>
      )}
    </div>
  );
}
