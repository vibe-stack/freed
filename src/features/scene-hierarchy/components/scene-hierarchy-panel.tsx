'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { useSceneStore, useSceneHierarchy } from '@/stores/scene-store';
import { useSelection, useSelectionStore } from '@/stores/selection-store';
import { Eye, EyeOff, Lock, Unlock, Camera, CameraOff, Folder, FolderOpen, Shapes, Trash2, Copy, Scissors, ClipboardPaste, FolderPlus } from 'lucide-react';
import { useClipboardStore } from '@/stores/clipboard-store';
import { ContextMenu } from '@base-ui-components/react/context-menu';

const Panel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
	<div className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-lg shadow-lg shadow-black/30 w-64 h-full ${className}`} {...rest}>
		{children}
	</div>
);

type RowProps = {
	id: string;
	name: string;
	depth: number;
	visible: boolean;
	locked: boolean;
	type: 'mesh' | 'light' | 'camera' | 'group' | 'particles' | 'force';
	render: boolean;
	renamingId: string | null;
	draftName: string;
	setRenamingId: (id: string | null) => void;
	setDraftName: (name: string) => void;
	isCollapsed?: boolean;
	onToggleCollapse?: (id: string) => void;
	portalContainer?: HTMLElement | null;
};
const Row: React.FC<RowProps>
	= ({ id, name, depth, visible, locked, type, render, renamingId, draftName, setRenamingId, setDraftName, isCollapsed = false, onToggleCollapse, portalContainer }) => {
		const selection = useSelection();
		const { selectObjects, enterEditMode, toggleObjectSelection } = useSelectionStore();
		const scene = useSceneStore();
		const isSelected = selection.objectIds.includes(id);
		const [isDragOver, setIsDragOver] = useState(false);

		const onClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
			if (e.shiftKey) {
				if (type === 'group') {
					const ids = [id, ...scene.getDescendants(id)];
					const allSelected = ids.every((oid) => selection.objectIds.includes(oid));
					if (allSelected) {
						const next = selection.objectIds.filter((oid) => !ids.includes(oid));
						selectObjects(next);
					} else {
						const set = new Set(selection.objectIds);
						ids.forEach((oid) => set.add(oid));
						selectObjects(Array.from(set));
					}
				} else {
					toggleObjectSelection(id);
				}
			} else {
				scene.selectObject(id);
				if (type === 'group') {
					const ids = [id, ...scene.getDescendants(id)];
					selectObjects(ids);
				} else {
					selectObjects([id]);
				}
			}
		};

		const handleDoubleClick = () => {
			const meshId = scene.objects[id]?.meshId;
			if (meshId) enterEditMode(meshId);
		};

		const commitRename = () => {
			if (renamingId === id) {
				const trimmed = draftName.trim();
				if (trimmed && trimmed !== name) scene.updateObject(id, (o) => { o.name = trimmed; });
				setRenamingId(null);
			}
		};

		const onDragStart: React.DragEventHandler<HTMLDivElement> = (e) => {
			if (locked) { e.preventDefault(); return; }
			const selectedIds = selection.objectIds.includes(id)
				? selection.objectIds
				: [id];
			e.dataTransfer.setData('application/x-object-ids', JSON.stringify(selectedIds));
			e.dataTransfer.effectAllowed = 'move';
		};

		const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
			e.preventDefault();
			if (locked) return;
			setIsDragOver(true);
			e.dataTransfer.dropEffect = 'move';
		};

		const onDragLeave: React.DragEventHandler<HTMLDivElement> = () => setIsDragOver(false);

		const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
			e.preventDefault();
			setIsDragOver(false);
			const data = e.dataTransfer.getData('application/x-object-ids');
			if (!data) return;
			let ids: string[] = [];
			try { ids = JSON.parse(data); } catch { return; }
			// Filter invalid or cyclic drops
			const isDescOf = (a: string, b: string) => scene.getDescendants(b).includes(a) || a === b;
			const sources = ids.filter((sid) => !isDescOf(id, sid));
			if (sources.length === 0) return;
			const target = scene.objects[id];
			if (!target) return;
			if (target.type === 'group' && !target.locked) {
				// Parent into group; append at end
				sources.forEach((sid) => scene.moveObject(sid, id));
				return;
			}
			// Otherwise, insert next to target under its parent
			const parentId = target.parentId;
			const siblings = parentId === null ? scene.rootObjects : scene.objects[parentId]?.children || [];
			const targetIndex = siblings.indexOf(id);
			const insertIndex = targetIndex + 1;
			sources.forEach((sid, i) => scene.moveObject(sid, parentId, insertIndex + i));
		};

		return (
			<ContextMenu.Root>
				<ContextMenu.Trigger
					className={`group flex items-center gap-1.5 px-2 py-1.5 text-sm cursor-default ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'} ${isDragOver ? 'ring-1 ring-white/30' : ''}`}
					onClick={onClick}
					onContextMenu={() => {
						// Ensure the row becomes active selection before opening
						if (!isSelected) {
							scene.selectObject(id);
							if (type === 'group') selectObjects([id, ...scene.getDescendants(id)]);
							else selectObjects([id]);
						}
					}}
					onDoubleClick={handleDoubleClick}
					draggable
					onDragStart={onDragStart}
					onDragOver={onDragOver}
					onDragLeave={onDragLeave}
					onDrop={onDrop}
				>
					<div style={{ width: depth * 12 }} />
					{/* type icon / folder toggle (smaller), click to expand/collapse groups */}
					<button
						className="shrink-0 text-gray-400 hover:text-gray-200"
						onClick={(e) => { if (type === 'group' && onToggleCollapse) { e.stopPropagation(); onToggleCollapse(id); } }}
						title={type === 'group' ? (isCollapsed ? 'Expand' : 'Collapse') : name}
						aria-label={type === 'group' ? (isCollapsed ? 'Expand' : 'Collapse') : 'Object'}
					>
						{type === 'group' ? (
							isCollapsed ? <Folder className="w-3.5 h-3.5" /> : <FolderOpen className="w-3.5 h-3.5" />
						) : (
							<Shapes className="w-3.5 h-3.5" />
						)}
					</button>

					<div className="truncate flex-1 text-gray-200">
						{renamingId === id ? (
							<input
								autoFocus
								value={draftName}
								onBlur={commitRename}
								onChange={(e) => setDraftName(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') commitRename();
									if (e.key === 'Escape') setRenamingId(null);
								}}
								className="w-full rounded-sm bg-black/40 border border-white/10 px-1 py-0.5 text-gray-200 outline-none"
							/>
						) : (
							name
						)}
					</div>

					{/* hover actions pinned to right, no layout when hidden */}
					<div className="hidden group-hover:flex items-center gap-1">
						<button
							className={`shrink-0 rounded text-[11px] p-0.5 ${visible ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-400'}`}
							onClick={(e) => {
								e.stopPropagation();
								if (type === 'group') scene.setVisibleRecursive(id, !visible);
								else scene.setVisible(id, !visible);
							}}
							title={visible ? 'Hide' : 'Show'}
							aria-label={visible ? 'Hide' : 'Show'}
						>{visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}</button>
						<button
							className={`shrink-0 rounded text-[11px] p-0.5 ${locked ? 'text-gray-500 hover:text-gray-400' : 'text-gray-300 hover:text-white'}`}
							onClick={(e) => {
								e.stopPropagation();
								if (type === 'group') scene.setLockedRecursive(id, !locked);
								else scene.setLocked(id, !locked);
							}}
							title={locked ? 'Unlock' : 'Lock'}
							aria-label={locked ? 'Unlock' : 'Lock'}
						>{locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}</button>
						<button
							className={`shrink-0 rounded text-[11px] p-0.5 ${render ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-400'}`}
							onClick={(e) => {
								e.stopPropagation();
								if (type === 'group') scene.setRenderRecursive(id, !render);
								else scene.setRender(id, !render);
							}}
							title={render ? 'Exclude from final render' : 'Include in final render'}
							aria-label={render ? 'Exclude from final render' : 'Include in final render'}
						>{render ? <Camera className="w-3.5 h-3.5" /> : <CameraOff className="w-3.5 h-3.5" />}</button>
					</div>
				</ContextMenu.Trigger>
				<ContextMenu.Portal container={portalContainer}>
					<ContextMenu.Positioner className="z-90">
						<ContextMenu.Popup
							className="z-[9999] min-w-48 rounded-md border border-white/10 bg-zinc-900/95 backdrop-blur-md p-1 text-sm text-gray-200 shadow-lg shadow-black/40"
							style={{ position: 'fixed', zIndex: 9999 }}
						>
							<ContextMenu.Item onClick={() => { setRenamingId(id); setDraftName(name); }}>
								<div className="flex items-center gap-2 px-2 py-1.5">
									<span>Rename</span>
								</div>
							</ContextMenu.Item>
							<ContextMenu.Separator />
							<ContextMenu.Item onClick={() => { if (type === 'group') scene.setVisibleRecursive(id, !visible); else scene.setVisible(id, !visible); }}>
								<div className="flex items-center gap-2 px-2 py-1.5">
									{visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
									<span>{visible ? 'Hide' : 'Show'}</span>
								</div>
							</ContextMenu.Item>
							<ContextMenu.Item onClick={() => { if (type === 'group') scene.setLockedRecursive(id, !locked); else scene.setLocked(id, !locked); }}>
								<div className="flex items-center gap-2 px-2 py-1.5">
									{locked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
									<span>{locked ? 'Unlock' : 'Lock'}</span>
								</div>
							</ContextMenu.Item>
							<ContextMenu.Item onClick={() => { if (type === 'group') scene.setRenderRecursive(id, !render); else scene.setRender(id, !render); }}>
								<div className="flex items-center gap-2 px-2 py-1.5">
									{render ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
									<span>{render ? 'Exclude from render' : 'Include in render'}</span>
								</div>
							</ContextMenu.Item>
							<ContextMenu.Separator />
							{type === 'group' && (
								<ContextMenu.Item onClick={() => scene.ungroupObject(id)}>
									<div className="flex items-center gap-2 px-2 py-1.5">
										<span>Ungroup</span>
									</div>
								</ContextMenu.Item>
							)}
							<ContextMenu.Item onClick={() => useClipboardStore.getState().copySelection()}>
								<div className="flex items-center gap-2 px-2 py-1.5">
									<Copy className="w-4 h-4" />
									<span>Copy</span>
								</div>
							</ContextMenu.Item>
							<ContextMenu.Item onClick={() => useClipboardStore.getState().cutSelection()}>
								<div className="flex items-center gap-2 px-2 py-1.5">
									<Scissors className="w-4 h-4" />
									<span>Cut</span>
								</div>
							</ContextMenu.Item>
							<ContextMenu.Item onClick={() => useClipboardStore.getState().paste()}>
								<div className="flex items-center gap-2 px-2 py-1.5">
									<ClipboardPaste className="w-4 h-4" />
									<span>Paste</span>
								</div>
							</ContextMenu.Item>
							<ContextMenu.Separator />
							<ContextMenu.Item onClick={() => scene.removeObject(id)}>
								<div className="flex items-center gap-2 px-2 py-1.5 text-red-300">
									<Trash2 className="w-4 h-4" />
									<span>Delete</span>
								</div>
							</ContextMenu.Item>
						</ContextMenu.Popup>
					</ContextMenu.Positioner>
				</ContextMenu.Portal>
			</ContextMenu.Root>
		);
	};

const SceneHierarchyPanel: React.FC = () => {
	const scene = useSceneStore();
	const hierarchy = useSceneHierarchy();
	const [query, setQuery] = useState('');
	const selection = useSelection();
	const [renamingId, setRenamingId] = useState<string | null>(null);
	const [draftName, setDraftName] = useState('');
	const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
	const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);

	useEffect(() => {
		setPortalContainer(document.body);
	}, []);

	const toggleCollapse = (id: string) => setCollapsed((prev) => {
		const next = new Set(prev);
		if (next.has(id)) next.delete(id); else next.add(id);
		return next;
	});

	const depthMap: Record<string, number> = {};
	const computeDepth = (id: string): number => {
		const obj = scene.objects[id];
		if (!obj) return 0;
		if (obj.parentId === null) return 0;
		if (depthMap[id] !== undefined) return depthMap[id];
		const d = 1 + computeDepth(obj.parentId);
		depthMap[id] = d;
		return d;
	};
	hierarchy.forEach(o => { depthMap[o.id] = computeDepth(o.id); });

	const filtered = useMemo(() => {
		if (!query.trim()) return hierarchy;
		const q = query.toLowerCase();
		// Include parents if any descendant matches
		const include = new Set<string>();
		const objects = scene.objects;
		const matches = (id: string): boolean => objects[id]?.name.toLowerCase().includes(q);
		const markAncestors = (id: string) => {
			let cur = objects[id]?.parentId;
			while (cur) { include.add(cur); cur = objects[cur]?.parentId || null; }
		};
		Object.values(objects).forEach((o) => {
			if (matches(o.id)) { include.add(o.id); markAncestors(o.id); }
		});
		return hierarchy.filter((o) => include.has(o.id));
	}, [hierarchy, scene.objects, query]);

	// Apply collapse (when no active search). If searching, ignore collapse so matches are visible.
	const visibleList = useMemo(() => {
		if (query.trim()) return filtered;
		if (collapsed.size === 0) return filtered;
		const collapsedSet = collapsed;
		const isHidden = (objId: string) => {
			let cur = scene.objects[objId]?.parentId;
			while (cur) {
				if (collapsedSet.has(cur)) return true;
				cur = scene.objects[cur]?.parentId || null;
			}
			return false;
		};
		return filtered.filter((o) => !isHidden(o.id));
	}, [filtered, collapsed, query, scene.objects]);

	return (
		<Panel className="p-2">
			<div className="flex items-center justify-between px-2 py-1">
				<div className="text-xs uppercase tracking-wide text-gray-400">Scene</div>
				<div className="text-[10px] text-gray-500">{Object.keys(scene.objects).length} items</div>
			</div>
			<div className="px-2 pb-2">
				<div className="flex items-center gap-2">
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search..."
						className="w-full rounded-md bg-black/30 border border-white/10 px-2 py-1 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:ring-1 focus:ring-white/20"
					/>
					<button
						className="shrink-0 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-300 hover:bg-white/5"
						onClick={() => scene.createGroupObject('Group')}
						title="New Group"
					>
						<FolderPlus className="w-4 h-4" />
					</button>
					<button
						className="shrink-0 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-50"
						disabled={selection.objectIds.length < 1}
						onClick={() => scene.groupObjects(selection.objectIds, 'Group')}
						title="Group Selection"
					>
						<span>Grp</span>
					</button>
					<button
						className="shrink-0 inline-flex items-center gap-1 rounded-md border border-white/10 bg-black/30 px-2 py-1 text-xs text-gray-300 hover:bg-white/5 disabled:opacity-50"
						disabled={selection.objectIds.length !== 1 || scene.objects[selection.objectIds[0]]?.type !== 'group'}
						onClick={() => selection.objectIds[0] && scene.ungroupObject(selection.objectIds[0])}
						title="Ungroup"
					>
						<span>Ungrp</span>
					</button>
				</div>
			</div>
			<div className="h-full max-h-[60dvh] overflow-auto">
				{/* Root drop zone */}
				<div
					className="mx-2 my-1 rounded border border-dashed border-white/10 px-2 py-1 text-[11px] text-gray-400"
					onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
					onDrop={(e) => {
						e.preventDefault();
						const data = e.dataTransfer.getData('application/x-object-ids');
						if (!data) return;
						let ids: string[] = [];
						try { ids = JSON.parse(data); } catch { return; }
						ids.forEach((sid) => scene.moveObject(sid, null));
					}}
				>
					Drop here to move to root
				</div>
				{scene.rootObjects.length === 0 && (
					<div className="p-3 text-xs text-gray-500">No objects. Use + Cube to add one.</div>
				)}
				{visibleList.map(obj => (
					<Row
						key={obj.id}
						id={obj.id}
						name={obj.name}
						depth={depthMap[obj.id] || 0}
						visible={obj.visible}
						locked={obj.locked}
						type={obj.type}
						render={obj.render}
						renamingId={renamingId}
						draftName={draftName}
						setRenamingId={setRenamingId}
						setDraftName={setDraftName}
						isCollapsed={collapsed.has(obj.id)}
						onToggleCollapse={toggleCollapse}
						portalContainer={portalContainer}
					/>
				))}
			</div>
		</Panel>
	);
};

export default SceneHierarchyPanel;
