import {
  useAddBriefingElement,
  useBriefing,
  useBriefings,
  useCreateBriefing,
  useCreateBriefingVersion,
  useDeleteBriefing,
  useUpdateBriefing,
  useUpdateBriefingStatus,
} from '@/hooks/queries/useBriefingQueries';
import { type BriefingElement } from '@/services/briefingService';
import { useAuthStore } from '@/store/authStore';
import { useTheme } from '@mui/material';
import React, { useEffect, useRef, useState } from 'react';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';
import { ConfirmDialog, useConfirmDialog } from './ui/ConfirmDialog';

export const BriefingWhiteboard: React.FC = () => {
  const theme = useTheme();
  const user = useAuthStore(s => s.user);
  const organizationId = user?.organizationId || user?.activeOrgId;
  const {
    data: briefings = [],
    isLoading,
    error: queryError,
  } = useBriefings({
    enabled: !!organizationId,
  });
  const [selectedBriefingId, setSelectedBriefingId] = useState<string | null>(null);
  const { data: currentBriefing } = useBriefing(selectedBriefingId ?? undefined);
  const [mutationError, setMutationError] = useState('');

  const createBriefingMutation = useCreateBriefing();
  const updateBriefingMutation = useUpdateBriefing();
  const deleteBriefingMutation = useDeleteBriefing();
  const updateStatusMutation = useUpdateBriefingStatus();
  const addElementMutation = useAddBriefingElement();
  const createVersionMutation = useCreateBriefingVersion();
  const [showForm, setShowForm] = useState(false);
  const [_showElementForm, _setShowElementForm] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<'text' | 'shape' | 'line' | 'arrow' | 'marker'>('marker');
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);

  const {
    openDialog: openDeleteConfirm,
    closeDialog: closeDeleteConfirm,
    pendingData: pendingDeleteId,
    dialogProps: deleteDialogProps,
  } = useConfirmDialog<string>();
  const {
    openDialog: openClearConfirm,
    closeDialog: closeClearConfirm,
    dialogProps: clearDialogProps,
  } = useConfirmDialog<void>();

  const [briefingForm, setBriefingForm] = useState({
    title: '',
    creatorId: '',
    missionId: '',
    tags: '',
  });

  const [_elementForm, _setElementForm] = useState({
    type: 'text' as 'text' | 'shape' | 'line' | 'arrow' | 'marker',
    x: 0,
    y: 0,
    data: '',
  });

  useEffect(() => {
    if (currentBriefing && canvasRef.current) {
      drawCanvas();
    }
  }, [currentBriefing]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas || !currentBriefing) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = theme.palette.background.paper;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = theme.palette.divider;
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // Draw elements
    currentBriefing.elements.forEach(element => {
      if (!element.data) return;
      ctx.strokeStyle = theme.palette.primary.main;
      ctx.fillStyle = theme.palette.primary.main;
      ctx.lineWidth = 2;

      switch (element.type) {
        case 'text':
          ctx.font = '16px Arial';
          ctx.fillText(String(element.data.text || ''), element.position.x, element.position.y);
          break;
        case 'shape':
          if (element.data.shape === 'circle') {
            ctx.beginPath();
            ctx.arc(
              element.position.x,
              element.position.y,
              (element.data.radius as number) || 30,
              0,
              2 * Math.PI
            );
            ctx.stroke();
          } else if (element.data.shape === 'rectangle') {
            ctx.strokeRect(
              element.position.x,
              element.position.y,
              (element.data.width as number) || 100,
              (element.data.height as number) || 60
            );
          }
          break;
        case 'line':
          ctx.beginPath();
          ctx.moveTo(element.position.x, element.position.y);
          ctx.lineTo(
            (element.data.endX as number) || element.position.x + 100,
            (element.data.endY as number) || element.position.y + 100
          );
          ctx.stroke();
          break;
        case 'arrow': {
          const endX = (element.data.endX as number) || element.position.x + 100;
          const endY = (element.data.endY as number) || element.position.y + 100;
          ctx.beginPath();
          ctx.moveTo(element.position.x, element.position.y);
          ctx.lineTo(endX, endY);
          ctx.stroke();
          // Draw arrowhead
          const angle = Math.atan2(endY - element.position.y, endX - element.position.x);
          ctx.beginPath();
          ctx.moveTo(endX, endY);
          ctx.lineTo(
            endX - 15 * Math.cos(angle - Math.PI / 6),
            endY - 15 * Math.sin(angle - Math.PI / 6)
          );
          ctx.lineTo(
            endX - 15 * Math.cos(angle + Math.PI / 6),
            endY - 15 * Math.sin(angle + Math.PI / 6)
          );
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'marker':
          ctx.beginPath();
          ctx.arc(element.position.x, element.position.y, 5, 0, 2 * Math.PI);
          ctx.fill();
          break;
      }
    });
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!currentBriefing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setStartPos({ x, y });
    setIsDrawing(true);

    if (tool === 'marker' || tool === 'text') {
      addElement(x, y);
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPos || !currentBriefing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;

    if (tool === 'line' || tool === 'arrow') {
      addElement(startPos.x, startPos.y, { endX, endY });
    } else if (tool === 'shape') {
      addElement(startPos.x, startPos.y, {
        shape: 'rectangle',
        width: Math.abs(endX - startPos.x),
        height: Math.abs(endY - startPos.y),
      });
    }

    setIsDrawing(false);
    setStartPos(null);
  };

  const addElement = async (x: number, y: number, additionalData?: Record<string, unknown>) => {
    if (!currentBriefing) return;

    const data: Record<string, unknown> = { ...additionalData };

    if (tool === 'text') {
      const text = prompt('Enter text:');
      if (!text) return;
      data.text = text;
    } else if (tool === 'shape' && !additionalData) {
      data.shape = 'circle';
      data.radius = 30;
    }

    try {
      await addElementMutation.mutateAsync({
        briefingId: currentBriefing.id,
        element: {
          type: tool,
          position: { x, y },
          ...data,
        } as BriefingElement,
      });
    } catch (err) {
      setMutationError('Failed to add element');
    }
  };

  const handleCreateBriefing = async (e: React.FormEvent) => {
    e.preventDefault();
    setMutationError('');

    try {
      await createBriefingMutation.mutateAsync({
        title: briefingForm.title,
        description: briefingForm.missionId || undefined,
      });
      setShowForm(false);
      setBriefingForm({ title: '', creatorId: '', missionId: '', tags: '' });
    } catch (err: unknown) {
      setMutationError(err instanceof Error ? err.message : 'Failed to create briefing');
    }
  };

  const handleDeleteBriefingClick = (id: string) => {
    openDeleteConfirm(id);
  };

  const handleDeleteBriefingConfirm = async () => {
    const id = pendingDeleteId;
    closeDeleteConfirm();
    if (!id) return;

    try {
      await deleteBriefingMutation.mutateAsync(id);
      if (selectedBriefingId === id) {
        setSelectedBriefingId(null);
      }
    } catch (err) {
      setMutationError('Failed to delete briefing');
    }
  };

  const handleUpdateStatus = async (status: 'draft' | 'active' | 'completed' | 'archived') => {
    if (!currentBriefing) return;

    try {
      await updateStatusMutation.mutateAsync({ id: currentBriefing.id, status });
    } catch (err) {
      setMutationError('Failed to update status');
    }
  };

  const handleClearCanvasClick = () => {
    if (!currentBriefing) return;
    openClearConfirm();
  };

  const handleClearCanvasConfirm = async () => {
    closeClearConfirm();
    if (!currentBriefing) return;

    try {
      await updateBriefingMutation.mutateAsync({
        id: currentBriefing.id,
        data: { elements: [] },
      });
    } catch (err) {
      setMutationError('Failed to clear canvas');
    }
  };

  const handleCreateVersion = async () => {
    if (!currentBriefing) return;

    try {
      await createVersionMutation.mutateAsync(currentBriefing.id);
    } catch (err) {
      setMutationError('Failed to create version');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading briefings..." />;
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <h2 style={{ color: 'var(--accent-cyan)', marginBottom: '2rem' }}>
        Mission Briefing Whiteboard
      </h2>

      {(queryError || mutationError) && (
        <ErrorMessage
          message={queryError ? 'Failed to load briefings' : mutationError}
          onDismiss={() => setMutationError('')}
        />
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: currentBriefing ? '300px 1fr' : '1fr',
          gap: '2rem',
        }}
      >
        {/* Briefings List */}
        <div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem',
            }}
          >
            <h3>Briefings</h3>
            <button
              onClick={() => setShowForm(!showForm)}
              style={{ padding: '0.3rem 0.8rem', fontSize: '0.9rem' }}
            >
              {showForm ? 'Cancel' : 'New'}
            </button>
          </div>

          {showForm && (
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1rem',
                border: '1px solid var(--border-color)',
              }}
            >
              <form onSubmit={handleCreateBriefing}>
                <div style={{ marginBottom: '0.8rem' }}>
                  <label htmlFor="title" style={{ fontSize: '0.9rem' }}>
                    Title
                  </label>
                  <input
                    type="text"
                    id="title"
                    value={briefingForm.title}
                    onChange={e => setBriefingForm({ ...briefingForm, title: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: '0.8rem' }}>
                  <label htmlFor="creatorId" style={{ fontSize: '0.9rem' }}>
                    Creator ID
                  </label>
                  <input
                    type="text"
                    id="creatorId"
                    value={briefingForm.creatorId}
                    onChange={e => setBriefingForm({ ...briefingForm, creatorId: e.target.value })}
                    required
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: '0.8rem' }}>
                  <label htmlFor="missionId" style={{ fontSize: '0.9rem' }}>
                    Mission ID (optional)
                  </label>
                  <input
                    type="text"
                    id="missionId"
                    value={briefingForm.missionId}
                    onChange={e => setBriefingForm({ ...briefingForm, missionId: e.target.value })}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ marginBottom: '0.8rem' }}>
                  <label htmlFor="tags" style={{ fontSize: '0.9rem' }}>
                    Tags (comma-separated)
                  </label>
                  <input
                    type="text"
                    id="tags"
                    value={briefingForm.tags}
                    onChange={e => setBriefingForm({ ...briefingForm, tags: e.target.value })}
                    placeholder="combat, stealth, recon"
                    style={{ width: '100%' }}
                  />
                </div>
                <button type="submit" style={{ width: '100%', padding: '0.5rem' }}>
                  Create
                </button>
              </form>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {briefings.map(briefing => (
              <div
                key={briefing.id}
                style={{
                  backgroundColor:
                    currentBriefing?.id === briefing.id
                      ? 'var(--accent-cyan)'
                      : 'var(--bg-secondary)',
                  color:
                    currentBriefing?.id === briefing.id
                      ? 'var(--bg-primary)'
                      : 'var(--text-primary)',
                  padding: '0.8rem',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: '1px solid var(--border-color)',
                }}
                onClick={() => setSelectedBriefingId(briefing.id)}
              >
                <div style={{ fontWeight: 'bold', fontSize: '0.95rem' }}>{briefing.title}</div>
                <div style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.3rem' }}>
                  v{briefing.version} • {briefing.status} • {briefing.elements.length} elements
                </div>
              </div>
            ))}
            {briefings.length === 0 && (
              <p
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.9rem',
                  textAlign: 'center',
                  padding: '1rem',
                }}
              >
                No briefings yet
              </p>
            )}
          </div>
        </div>

        {/* Whiteboard Editor */}
        {currentBriefing && (
          <div>
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                marginBottom: '1rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '1rem',
                }}
              >
                <div>
                  <h3 style={{ color: 'var(--accent-cyan)', marginBottom: '0.3rem' }}>
                    {currentBriefing.title}
                  </h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Version {currentBriefing.version} • Status:
                    <span style={{ textTransform: 'capitalize', marginLeft: '0.3rem' }}>
                      {currentBriefing.status}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="secondary"
                    onClick={handleCreateVersion}
                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    New Version
                  </button>
                  <button
                    className="danger"
                    onClick={() => handleDeleteBriefingClick(currentBriefing.id)}
                    style={{ padding: '0.3rem 0.8rem', fontSize: '0.85rem' }}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <button
                  className={currentBriefing.status === 'draft' ? 'success' : 'secondary'}
                  onClick={() => handleUpdateStatus('draft')}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                >
                  Draft
                </button>
                <button
                  className={currentBriefing.status === 'active' ? 'success' : 'secondary'}
                  onClick={() => handleUpdateStatus('active')}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                >
                  Active
                </button>
                <button
                  className={currentBriefing.status === 'completed' ? 'success' : 'secondary'}
                  onClick={() => handleUpdateStatus('completed')}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                >
                  Completed
                </button>
                <button
                  className={currentBriefing.status === 'archived' ? 'success' : 'secondary'}
                  onClick={() => handleUpdateStatus('archived')}
                  style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                >
                  Archived
                </button>
              </div>

              {/* Drawing Tools */}
              <div style={{ marginBottom: '1rem' }}>
                <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem', fontWeight: 'bold' }}>
                  Drawing Tools
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    className={tool === 'marker' ? 'success' : 'secondary'}
                    onClick={() => setTool('marker')}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                  >
                    ● Marker
                  </button>
                  <button
                    className={tool === 'text' ? 'success' : 'secondary'}
                    onClick={() => setTool('text')}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                  >
                    T Text
                  </button>
                  <button
                    className={tool === 'shape' ? 'success' : 'secondary'}
                    onClick={() => setTool('shape')}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                  >
                    ◻ Shape
                  </button>
                  <button
                    className={tool === 'line' ? 'success' : 'secondary'}
                    onClick={() => setTool('line')}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                  >
                    / Line
                  </button>
                  <button
                    className={tool === 'arrow' ? 'success' : 'secondary'}
                    onClick={() => setTool('arrow')}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem' }}
                  >
                    → Arrow
                  </button>
                  <button
                    className="danger"
                    onClick={handleClearCanvasClick}
                    style={{ padding: '0.3rem 0.6rem', fontSize: '0.85rem', marginLeft: 'auto' }}
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>

            {/* Canvas */}
            <div
              style={{
                backgroundColor: 'var(--bg-secondary)',
                padding: '1rem',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}
            >
              <canvas
                ref={canvasRef}
                width={1000}
                height={600}
                style={{
                  border: '2px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'crosshair',
                  width: '100%',
                  height: 'auto',
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseUp={handleCanvasMouseUp}
              />
              <div
                style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}
              >
                Elements: {currentBriefing.elements.length} • Current Tool: {tool} • Click to add
                markers/text, drag for lines/shapes/arrows
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        {...deleteDialogProps}
        title="Delete Briefing"
        message="Are you sure you want to delete this briefing?"
        confirmLabel="Delete"
        confirmColor="error"
        onConfirm={handleDeleteBriefingConfirm}
      />
      <ConfirmDialog
        {...clearDialogProps}
        title="Clear Canvas"
        message="Clear all elements from the canvas?"
        confirmLabel="Clear"
        confirmColor="warning"
        onConfirm={handleClearCanvasConfirm}
      />
    </div>
  );
};

import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';

export const BriefingWhiteboardWithErrorBoundary: React.FC = () => (
  <FeatureErrorBoundary featureName="Briefing Whiteboard">
    <BriefingWhiteboard />
  </FeatureErrorBoundary>
);
