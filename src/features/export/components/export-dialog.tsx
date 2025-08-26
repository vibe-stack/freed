'use client';

import React, { useMemo, useState } from 'react';
import { Dialog } from '@base-ui-components/react/dialog';
import { useSceneStore } from '@/stores/scene-store';
import { useGeometryStore } from '@/stores/geometry-store';
import { ChevronDown, ChevronRight, Download } from 'lucide-react';
import { buildThreeScene, downloadBlob, exportThreeScene, ExportFormat } from '@/utils/three-export';
import { buildExportSceneFromLive } from '@/utils/live-scene-export';

export type ExportDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

const ExportDialog: React.FC<ExportDialogProps> = ({ open, onOpenChange }) => {
  const sceneStore = useSceneStore();
  const geometryStore = useGeometryStore();

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [includeChildren, setIncludeChildren] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(sceneStore.rootObjects));
  const [format, setFormat] = useState<ExportFormat>('glb');

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleExpand = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }));

  const tree = useMemo(() => {
    const build = (id: string): any => {
      const o = sceneStore.objects[id];
      return {
        id,
        name: o?.name ?? 'Unnamed',
        children: (o?.children ?? []).map(build),
      };
    };
    return sceneStore.rootObjects.map(build);
  }, [sceneStore.objects, sceneStore.rootObjects]);

  const exportNow = async () => {
    const includeObjectIds = Array.from(selectedIds);
    if (includeObjectIds.length === 0) return;

    // Prefer exporting directly from the live scene (includes lights, cameras, node materials normalized)
    let scene;
    try {
      scene = buildExportSceneFromLive({ includeObjectIds, includeChildren, format });
    } catch (e) {
      // Fallback to offline builder if something goes wrong
      // scene = buildThreeScene({
      //   objects: sceneStore.objects,
      //   rootObjects: sceneStore.rootObjects,
      //   meshes: geometryStore.meshes,
      //   materials: geometryStore.materials,
      //   includeObjectIds,
      //   includeChildren,
      // });
      console.error("COULDNT EXPORT", e)
      return;
    }

    const baseName = `export_${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const { blob, suggestedName } = await exportThreeScene(scene, format, baseName);
    downloadBlob(blob, suggestedName);
    onOpenChange(false);
  };

  const formatButtons: { label: string; value: ExportFormat }[] = [
    { label: 'GLB (Binary GLTF)', value: 'glb' },
    { label: 'GLTF (JSON)', value: 'gltf' },
    { label: 'OBJ', value: 'obj' },
    { label: 'STL', value: 'stl' },
  ];

  return (
    <Dialog.Root modal open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[720px] max-w-[96vw] rounded-xl border border-white/10 bg-[#0b0e13] p-4 shadow-2xl text-sm text-gray-200">
          <div className="flex items-start gap-3">
            <div className="flex-1">
              <Dialog.Title className="text-base font-semibold text-white">Export</Dialog.Title>
              <Dialog.Description className="mt-1 text-gray-400">
                Choose format and which objects to include from the scene tree.
              </Dialog.Description>
            </div>
            <Dialog.Close className="rounded p-1 text-gray-400 hover:text-white hover:bg-white/10">✕</Dialog.Close>
          </div>

          <div className="mt-4 grid grid-cols-12 gap-4">
            <div className="col-span-7 rounded-lg border border-white/10 bg-white/5">
              <div className="flex items-center justify-between border-b border-white/10 px-3 py-2 text-[12px] text-gray-300">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" className="accent-white/80" checked={includeChildren} onChange={(e) => setIncludeChildren(e.target.checked)} />
                  Include children of selected
                </label>
              </div>
              <div className="max-h-[340px] overflow-auto p-2 space-y-1">
                {tree.map((node) => (
                  <TreeNode
                    key={node.id}
                    node={node}
                    expanded={expanded}
                    onToggleExpand={toggleExpand}
                    selected={selectedIds}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </div>
            </div>

            <div className="col-span-5 rounded-lg border border-white/10 bg-white/5 p-3">
              <div className="text-[12px] font-semibold text-gray-300">Format</div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {formatButtons.map((b) => (
                  <button
                    key={b.value}
                    className={`rounded border px-2 py-1.5 text-[12px] ${format === b.value ? 'border-white/30 bg-white/15 text-white' : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'}`}
                    onClick={() => setFormat(b.value)}
                  >
                    {b.label}
                  </button>
                ))}
              </div>

              <div className="mt-6">
                <button
                  className="inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-3 py-2 text-[12px] text-emerald-200 hover:bg-emerald-500/25 hover:text-white"
                  onClick={exportNow}
                >
                  <Download className="h-4 w-4" /> Export
                </button>
              </div>
            </div>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

const TreeNode: React.FC<{
  node: { id: string; name: string; children: any[] };
  expanded: Record<string, boolean>;
  onToggleExpand: (id: string) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
}> = ({ node, expanded, onToggleExpand, selected, onToggleSelect }) => {
  const isExpanded = expanded[node.id] ?? true;
  const hasChildren = (node.children?.length ?? 0) > 0;
  return (
    <div className="">
      <div className="flex items-center gap-2 rounded px-2 py-1 hover:bg-white/10">
        <button
          className="rounded p-0.5 text-gray-400 hover:text-white hover:bg-white/10"
          onClick={() => onToggleExpand(node.id)}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          {hasChildren ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="inline-block w-3.5" />}
        </button>
        <input
          type="checkbox"
          className="accent-white/80"
          checked={selected.has(node.id)}
          onChange={() => onToggleSelect(node.id)}
        />
        <span className="text-[12px] text-gray-200">{node.name}</span>
      </div>
      {hasChildren && isExpanded && (
        <div className="ml-6 border-l border-white/10 pl-2">
          {node.children.map((c) => (
            <TreeNode key={c.id} node={c} expanded={expanded} onToggleExpand={onToggleExpand} selected={selected} onToggleSelect={onToggleSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ExportDialog;
