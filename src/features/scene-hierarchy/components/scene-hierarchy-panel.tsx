'use client';

import React from 'react';
import { useSceneStore, useSceneHierarchy } from '@/stores/scene-store';
import { useSelection, useSelectionStore } from '@/stores/selection-store';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';

const Panel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className = '', children, ...rest }) => (
	<div className={`bg-black/40 backdrop-blur-md border border-white/10 rounded-lg shadow-lg shadow-black/30 w-80 h-full ${className}`} {...rest}>
		{children}
	</div>
);

const Row: React.FC<{ id: string; name: string; depth: number; visible: boolean; locked: boolean }>
	= ({ id, name, depth, visible, locked }) => {
	const selection = useSelection();
	const { selectObjects, enterEditMode } = useSelectionStore();
	const scene = useSceneStore();
	const isSelected = selection.objectIds.includes(id);

	const handleClick = () => {
		scene.selectObject(id);
		selectObjects([id]);
	};

	const handleDoubleClick = () => {
		const meshId = scene.objects[id]?.meshId;
		if (meshId) enterEditMode(meshId);
	};

	return (
		<div
			className={`flex items-center gap-2 px-2 py-1.5 text-sm cursor-default ${isSelected ? 'bg-white/10' : 'hover:bg-white/5'}`}
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
		>
			<div style={{ width: depth * 12 }} />
			<button
				className={`w-5 h-5 rounded text-[11px] ${visible ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-400'}`}
				onClick={(e) => { e.stopPropagation(); scene.setVisible(id, !visible); }}
				title={visible ? 'Hide' : 'Show'}
				aria-label={visible ? 'Hide' : 'Show'}
			>{visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}</button>
			<button
				className={`w-5 h-5 rounded text-[11px] ${locked ? 'text-gray-500 hover:text-gray-400' : 'text-gray-300 hover:text-white'}`}
				onClick={(e) => { e.stopPropagation(); scene.setLocked(id, !locked); }}
				title={locked ? 'Unlock' : 'Lock'}
				aria-label={locked ? 'Unlock' : 'Lock'}
			>{locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}</button>
			<div className="truncate flex-1 text-gray-200">{name}</div>
		</div>
	);
};

const SceneHierarchyPanel: React.FC = () => {
	const scene = useSceneStore();
	const hierarchy = useSceneHierarchy();

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

	return (
		<Panel className="p-2">
			<div className="flex items-center justify-between px-2 py-1">
				<div className="text-xs uppercase tracking-wide text-gray-400">Scene</div>
				<div className="text-[10px] text-gray-500">{Object.keys(scene.objects).length} items</div>
			</div>
			<div className="h-[calc(100%-28px)] overflow-auto">
				{scene.rootObjects.length === 0 && (
					<div className="p-3 text-xs text-gray-500">No objects. Use + Cube to add one.</div>
				)}
				{hierarchy.map(obj => (
					<Row
						key={obj.id}
						id={obj.id}
						name={obj.name}
						depth={depthMap[obj.id] || 0}
						visible={obj.visible}
						locked={obj.locked}
					/>
				))}
			</div>
		</Panel>
	);
};

export default SceneHierarchyPanel;
