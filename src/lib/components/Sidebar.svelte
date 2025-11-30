<script lang="ts">
	import { appState } from '$lib/appState.svelte';
	import FileTree from './FileTree.svelte';

	let newItemName = $state('');
	let showNewFolder = $state(false);
	let showNewFile = $state(false);
	let selectedFolderId = $state<number | null>(null);
	let isDragOverRoot = $state(false);

	async function handleCreateFolder() {
		if (!newItemName.trim()) return;
		await appState.newFolder(newItemName.trim(), selectedFolderId);
		newItemName = '';
		showNewFolder = false;
	}

	async function handleCreateFile() {
		if (!newItemName.trim()) return;
		// Create file at root level if no folder selected, or in selected folder
		await appState.newFile(selectedFolderId, newItemName.trim());
		newItemName = '';
		showNewFile = false;
	}

	function handleKeydown(event: KeyboardEvent, action: 'folder' | 'file') {
		if (event.key === 'Enter') {
			if (action === 'folder') {
				handleCreateFolder();
			} else {
				handleCreateFile();
			}
		} else if (event.key === 'Escape') {
			newItemName = '';
			showNewFolder = false;
			showNewFile = false;
		}
	}

	// Handle dropping items to root level
	function handleRootDragOver(event: DragEvent) {
		// Only handle if dropping directly on the container, not on a tree item
		const target = event.target as HTMLElement;
		if (target.classList.contains('file-tree-container') || target.classList.contains('root-drop-zone')) {
			event.preventDefault();
			event.stopPropagation();
			if (event.dataTransfer) {
				event.dataTransfer.dropEffect = 'move';
			}
			isDragOverRoot = true;
		}
	}

	function handleRootDragLeave(event: DragEvent) {
		const target = event.target as HTMLElement;
		if (target.classList.contains('file-tree-container') || target.classList.contains('root-drop-zone')) {
			isDragOverRoot = false;
		}
	}

	async function handleRootDrop(event: DragEvent) {
		const target = event.target as HTMLElement;
		if (!target.classList.contains('file-tree-container') && !target.classList.contains('root-drop-zone')) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		isDragOverRoot = false;

		const data = event.dataTransfer?.getData('text/plain');
		if (!data) return;

		try {
			const draggedData = JSON.parse(data);
			const draggedType = draggedData.type as 'file' | 'folder';
			const draggedId = draggedData.id as number;

			// Don't move if already at root
			if (draggedData.parentId === null) return;

			if (draggedType === 'file') {
				await appState.moveFileToFolder(draggedId, null);
			} else {
				await appState.moveFolderToParent(draggedId, null);
			}
		} catch (error) {
			console.error('Failed to handle root drop:', error);
		}
	}
</script>

<aside class="sidebar">
	<div class="sidebar-header">
		<span class="title">EXPLORER</span>
		<div class="actions">
			<button
				class="action-btn"
				title="New File"
				onclick={() => {
					showNewFile = true;
					showNewFolder = false;
				}}
			>
				<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
					<path d="M9.5 1.75V7h5.25a.75.75 0 010 1.5H9.5v5.25a.75.75 0 01-1.5 0V8.5H2.75a.75.75 0 010-1.5H8V1.75a.75.75 0 011.5 0z"/>
				</svg>
			</button>
			<button
				class="action-btn"
				title="New Folder"
				onclick={() => {
					showNewFolder = true;
					showNewFile = false;
				}}
			>
				<svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
					<path d="M7.5 3.5v-2h-6v13h13v-11h-7zm.5-3l.5.5h7l.5.5v12l-.5.5H1L.5 13V1L1 .5h7zm3.5 7H9V5h-1v2.5H5.5v1H8V11h1V8.5h2.5v-1z"/>
				</svg>
			</button>
		</div>
	</div>

	{#if showNewFolder}
		<div class="new-item-input">
			<input
				type="text"
				placeholder="Folder name..."
				bind:value={newItemName}
				onkeydown={(e) => handleKeydown(e, 'folder')}
			/>
			<button onclick={handleCreateFolder}>Create</button>
		</div>
	{/if}

	{#if showNewFile}
		<div class="new-item-input">
			<input
				type="text"
				placeholder="File name..."
				bind:value={newItemName}
				onkeydown={(e) => handleKeydown(e, 'file')}
			/>
			<button onclick={handleCreateFile}>Create</button>
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div 
		class="file-tree-container"
		class:drag-over-root={isDragOverRoot}
		ondragover={handleRootDragOver}
		ondragleave={handleRootDragLeave}
		ondrop={handleRootDrop}
	>
		<FileTree items={appState.fileTree} />
		{#if appState.fileTree.length === 0}
			<div class="empty-state">
				<p>No files yet</p>
				<p class="hint">Create a file or folder to get started</p>
			</div>
		{/if}
		<div 
			class="root-drop-zone"
			class:visible={isDragOverRoot}
		>
			Drop here to move to root
		</div>
	</div>
</aside>

<style>
	.sidebar {
		display: flex;
		flex-direction: column;
		width: 100%;
		height: 100%;
		background: #161b22;
		border-right: 1px solid #30363d;
		overflow: hidden;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 12px;
		height: 41px;
		min-height: 41px;
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: #8b949e;
		border-bottom: 1px solid #30363d;
		box-sizing: border-box;
	}

	.actions {
		display: flex;
		gap: 4px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border: none;
		background: transparent;
		color: #c9d1d9;
		cursor: pointer;
		border-radius: 4px;
		transition: background-color 0.15s;
	}

	.action-btn:hover {
		background: #21262d;
	}

	.new-item-input {
		display: flex;
		gap: 4px;
		padding: 8px;
		border-bottom: 1px solid #30363d;
	}

	.new-item-input input {
		flex: 1;
		padding: 4px 8px;
		border: 1px solid #30363d;
		border-radius: 6px;
		background: #0d1117;
		color: #c9d1d9;
		font-size: 13px;
	}

	.new-item-input input:focus {
		outline: none;
		border-color: #58a6ff;
		box-shadow: 0 0 0 2px rgba(88, 166, 255, 0.2);
	}

	.new-item-input button {
		padding: 4px 12px;
		border: none;
		border-radius: 6px;
		background: #238636;
		color: #ffffff;
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: background-color 0.15s;
	}

	.new-item-input button:hover {
		background: #2ea043;
	}

	.file-tree-container {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 8px;
		min-height: 0;
		background: #161b22;
		position: relative;
		transition: background-color 0.15s;
	}

	.file-tree-container.drag-over-root {
		background: #1a3a5c;
	}

	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 24px;
		color: #8b949e;
		text-align: center;
	}

	.empty-state p {
		margin: 0;
	}

	.empty-state .hint {
		font-size: 12px;
		margin-top: 4px;
		opacity: 0.7;
	}

	.root-drop-zone {
		position: absolute;
		bottom: 8px;
		left: 8px;
		right: 8px;
		padding: 12px;
		background: #1a3a5c;
		border: 2px dashed #58a6ff;
		border-radius: 6px;
		color: #58a6ff;
		font-size: 12px;
		text-align: center;
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.15s;
	}

	.root-drop-zone.visible {
		opacity: 1;
		pointer-events: auto;
	}
</style>
