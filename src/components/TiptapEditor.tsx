'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { FontFamily } from '@tiptap/extension-font-family';
import { Placeholder } from '@tiptap/extension-placeholder';
import { HardBreak } from '@tiptap/extension-hard-break';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import { Paragraph } from '@tiptap/extension-paragraph';
import { FontSize } from './extensions/FontSize';
import EditorToolbar from './EditorToolbar';
import { useEffect, useState } from 'react';
import { NodeSelection, TextSelection } from 'prosemirror-state';

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  signature?: string;
  onRegisterInsert?: (insert: (html: string, insertPos?: number) => void) => void;
  onFilesDropped?: (files: File[], insertPos?: number) => void;
}

export default function TiptapEditor({ value, onChange, placeholder, signature, onRegisterInsert, onFilesDropped }: TiptapEditorProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
  const findImageToRight = (state: unknown, pos: number) => {
    const direct = state.doc.nodeAt(pos);
    if (direct?.type?.name === 'image') return { pos, node: direct };
    const $pos = state.doc.resolve(pos);
    const childAfter = $pos.parent.childAfter($pos.parentOffset);
    if (childAfter.node?.type.name === 'image') {
      return { pos: $pos.start() + childAfter.offset, node: childAfter.node };
    }
    if ($pos.parentOffset === $pos.parent.content.size) {
      const nextBlockPos = $pos.after();
      const nextBlock = state.doc.nodeAt(nextBlockPos);
      if (nextBlock?.type?.name === 'paragraph') {
        const firstChild = nextBlock.firstChild;
        if (firstChild?.type?.name === 'image') {
          return { pos: nextBlockPos + 1, node: firstChild };
        }
      }
    }
    return null;
  };

  const findImageToLeft = (state: unknown, pos: number) => {
    const direct = pos > 0 ? state.doc.nodeAt(pos - 1) : null;
    if (direct?.type?.name === 'image') return { pos: pos - 1, node: direct };
    const $pos = state.doc.resolve(pos);
    const childBefore = $pos.parent.childBefore($pos.parentOffset);
    if (childBefore.node?.type.name === 'image') {
      return { pos: $pos.start() + childBefore.offset, node: childBefore.node };
    }
    if ($pos.parentOffset === 0) {
      const parentPos = $pos.before();
      const $parentPos = state.doc.resolve(parentPos);
      const prevBlock = $parentPos.nodeBefore;
      if (prevBlock?.type?.name === 'paragraph') {
        const lastChild = prevBlock.lastChild;
        if (lastChild?.type?.name === 'image') {
          const prevBlockStart = parentPos - prevBlock.nodeSize;
          const lastChildPos = prevBlockStart + 1 + (prevBlock.content.size - lastChild.nodeSize);
          return { pos: lastChildPos, node: lastChild };
        }
      }
    }
    return null;
  };
  const InlineImage = Image.extend({
    inline: true,
    group: 'inline',
    draggable: true,
    addAttributes() {
      return {
        ...this.parent?.(),
        width: {
          default: null,
          parseHTML: element => element.getAttribute('width') || element.style.width || null,
          renderHTML: attributes =>
            attributes.width
              ? { width: attributes.width }
              : {},
        },
        'data-ambmail-cid': {
          default: null,
          parseHTML: element => element.getAttribute('data-ambmail-cid'),
          renderHTML: attributes =>
            attributes['data-ambmail-cid']
              ? { 'data-ambmail-cid': attributes['data-ambmail-cid'] }
              : {},
        },
        indent: {
          default: 0,
          parseHTML: element => {
            const raw = element.getAttribute('data-ambmail-indent') || '0';
            const parsed = parseInt(raw, 10);
            return Number.isNaN(parsed) ? 0 : parsed;
          },
          renderHTML: attributes =>
            attributes.indent
              ? { 'data-ambmail-indent': attributes.indent }
              : {},
        },
        style: {
          default: null,
          parseHTML: element => element.getAttribute('style'),
          renderHTML: attributes => {
            const width = attributes.width ? `width:${attributes.width};` : '';
            const existing = attributes.style ? `${attributes.style};` : '';
            const base = 'max-width:100%;height:auto;';
            const indent = attributes.indent ? `transform:translateX(${attributes.indent}px);` : '';
            return { style: `${existing}${width}${base}${indent}` };
          },
        },
      };
    },
    addNodeView() {
      return ({ node, editor, getPos }) => {
        const wrapper = document.createElement('span');
        wrapper.style.display = 'inline-flex';
        wrapper.style.alignItems = 'flex-start';
        wrapper.style.overflow = 'hidden';
        wrapper.style.border = '2px solid transparent';
        wrapper.style.borderRadius = '4px';
        wrapper.draggable = true;
        wrapper.style.minWidth = '80px';
        wrapper.style.minHeight = '0';
        wrapper.style.position = 'relative';
        wrapper.style.boxSizing = 'border-box';
        if (node.attrs.indent) {
          wrapper.style.transform = `translateX(${node.attrs.indent}px)`;
        }
        wrapper.style.verticalAlign = 'baseline';
        wrapper.style.lineHeight = 'normal';
        wrapper.style.height = 'auto';
        wrapper.style.maxWidth = '100%';

        const img = document.createElement('img');
        img.src = node.attrs.src;
        if (node.attrs.alt) img.alt = node.attrs.alt;
        if (node.attrs.title) img.title = node.attrs.title;
        if (node.attrs['data-ambmail-cid']) {
          img.setAttribute('data-ambmail-cid', node.attrs['data-ambmail-cid']);
        }
        img.style.width = '100%';
        img.style.height = 'auto';
        img.style.objectFit = 'contain';
        img.style.objectPosition = 'top left';
        img.style.display = 'block';
        img.style.margin = '0';
        img.style.maxWidth = 'none';
        img.style.maxHeight = 'none';
        wrapper.appendChild(img);

        const resizeHandle = document.createElement('div');
        resizeHandle.style.position = 'absolute';
        resizeHandle.style.right = '2px';
        resizeHandle.style.bottom = '2px';
        resizeHandle.style.width = '12px';
        resizeHandle.style.height = '12px';
        resizeHandle.style.borderRadius = '2px';
        resizeHandle.style.background = '#3b82f6';
        resizeHandle.style.cursor = 'nwse-resize';
        resizeHandle.style.display = 'none';
        resizeHandle.style.boxShadow = '0 0 0 1px #ffffff';
        resizeHandle.style.transform = 'scale(1)';
        resizeHandle.style.transition = 'transform 120ms ease, box-shadow 120ms ease';
        resizeHandle.style.zIndex = '1';
        resizeHandle.draggable = false;
        wrapper.appendChild(resizeHandle);

        const setInitialSize = () => {
          if (node.attrs.width || node.attrs.height) return;
          const naturalWidth = img.naturalWidth || 0;
          const naturalHeight = img.naturalHeight || 0;
          if (!naturalWidth || !naturalHeight) return;
          const maxWidth = 600;
          const scale = naturalWidth > maxWidth ? maxWidth / naturalWidth : 1;
          const width = Math.round(naturalWidth * scale);
          wrapper.style.width = `${width}px`;
          updateAttrs(`${width}px`);
        };
        img.addEventListener('load', setInitialSize);

        const applySize = () => {
          if (node.attrs.width) wrapper.style.width = node.attrs.width;
        };
        applySize();

        const updateAttrs = (width: string) => {
          const pos = getPos?.();
          if (typeof pos !== 'number') return;
          editor.commands.command(({ tr }) => {
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width,
            });
            return true;
          });
        };

        const syncFromWrapper = () => {
          const rect = wrapper.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          updateAttrs(`${Math.round(rect.width)}px`);
        };
        wrapper.addEventListener('mouseup', syncFromWrapper);
        wrapper.addEventListener('touchend', syncFromWrapper);

        const showHandle = () => {
          resizeHandle.style.transform = 'scale(1.15)';
          resizeHandle.style.boxShadow = '0 0 0 2px #93c5fd';
        };

        const hideHandle = () => {
          resizeHandle.style.transform = 'scale(1)';
          resizeHandle.style.boxShadow = '0 0 0 1px #ffffff';
        };

        wrapper.addEventListener('mouseenter', showHandle);
        wrapper.addEventListener('mouseleave', hideHandle);

        const minSize = 80;
        const startResize = (startEvent: PointerEvent) => {
          startEvent.preventDefault();
          startEvent.stopPropagation();
          resizeHandle.setPointerCapture(startEvent.pointerId);
          const rect = wrapper.getBoundingClientRect();
          const startWidth = rect.width || minSize;
          const startX = startEvent.clientX;
          const startY = startEvent.clientY;

          const onMove = (moveEvent: PointerEvent) => {
            const currentX = moveEvent.clientX;
            const currentY = moveEvent.clientY;
            const deltaX = currentX - startX;
            const deltaY = currentY - startY;
            const delta = Math.max(deltaX, deltaY);
            const editorWidth = editor?.view?.dom?.clientWidth || 0;
            const maxWidth = editorWidth ? Math.max(minSize, Math.round(editorWidth - 32)) : Number.POSITIVE_INFINITY;
            const rawWidth = Math.round(startWidth + delta);
            const nextWidth = Math.max(minSize, Math.min(maxWidth, rawWidth));
            wrapper.style.width = `${nextWidth}px`;
          };

          const onEnd = () => {
            resizeHandle.removeEventListener('pointermove', onMove);
            resizeHandle.removeEventListener('pointerup', onEnd);
            resizeHandle.removeEventListener('pointercancel', onEnd);
            syncFromWrapper();
          };

          resizeHandle.addEventListener('pointermove', onMove);
          resizeHandle.addEventListener('pointerup', onEnd);
          resizeHandle.addEventListener('pointercancel', onEnd);
        };

        resizeHandle.addEventListener('pointerdown', startResize);

        const destroy = () => {
          img.removeEventListener('load', setInitialSize);
          img.removeEventListener('load', setInitialSize);
          wrapper.removeEventListener('mouseup', syncFromWrapper);
          wrapper.removeEventListener('touchend', syncFromWrapper);
          wrapper.removeEventListener('mouseenter', showHandle);
          wrapper.removeEventListener('mouseleave', hideHandle);
          resizeHandle.removeEventListener('pointerdown', startResize);
        };

        return {
          dom: wrapper,
          selectNode: () => {
            wrapper.style.borderColor = '#3b82f6';
            resizeHandle.style.display = 'block';
          },
          deselectNode: () => {
            wrapper.style.borderColor = 'transparent';
            resizeHandle.style.display = 'none';
          },
          update: updatedNode => {
            if (updatedNode.type.name !== node.type.name) return false;
            node = updatedNode;
            img.src = node.attrs.src;
            if (node.attrs.alt) img.alt = node.attrs.alt;
            else img.removeAttribute('alt');
            if (node.attrs.title) img.title = node.attrs.title;
            else img.removeAttribute('title');
            if (node.attrs['data-ambmail-cid']) {
              img.setAttribute('data-ambmail-cid', node.attrs['data-ambmail-cid']);
            } else {
              img.removeAttribute('data-ambmail-cid');
            }
            if (node.attrs.indent) {
              wrapper.style.transform = `translateX(${node.attrs.indent}px)`;
            } else {
              wrapper.style.transform = 'translateX(0)';
            }
            applySize();
            return true;
          },
          destroy,
        };
      };
    },
  });
  const StyledParagraph = Paragraph.extend({
    parseHTML() {
      return [
        { tag: 'p' },
        { tag: 'div' },
      ];
    },
    addAttributes() {
      return {
        ...this.parent?.(),
        style: {
          default: null,
          parseHTML: element => element.getAttribute('style'),
          renderHTML: attributes => (attributes.style ? { style: attributes.style } : {}),
        },
      };
    },
  });
  const StyledTable = Table.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        style: {
          default: null,
          parseHTML: element => element.getAttribute('style'),
          renderHTML: attributes => (attributes.style ? { style: attributes.style } : {}),
        },
        cellpadding: {
          default: null,
          parseHTML: element => element.getAttribute('cellpadding'),
          renderHTML: attributes => (attributes.cellpadding ? { cellpadding: attributes.cellpadding } : {}),
        },
        cellspacing: {
          default: null,
          parseHTML: element => element.getAttribute('cellspacing'),
          renderHTML: attributes => (attributes.cellspacing ? { cellspacing: attributes.cellspacing } : {}),
        },
        border: {
          default: null,
          parseHTML: element => element.getAttribute('border'),
          renderHTML: attributes => (attributes.border ? { border: attributes.border } : {}),
        },
      };
    },
  });
  const StyledTableCell = TableCell.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        style: {
          default: null,
          parseHTML: element => element.getAttribute('style'),
          renderHTML: attributes => (attributes.style ? { style: attributes.style } : {}),
        },
      };
    },
  });
  const StyledTableHeader = TableHeader.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        style: {
          default: null,
          parseHTML: element => element.getAttribute('style'),
          renderHTML: attributes => (attributes.style ? { style: attributes.style } : {}),
        },
      };
    },
  });
  const LineBreak = HardBreak.extend({
    addKeyboardShortcuts() {
      return {
        Enter: () => this.editor.commands.setHardBreak(),
        'Shift-Enter': () => this.editor.commands.setHardBreak(),
      };
    },
  });
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bold: false,
        italic: false,
        strike: false,
        underline: false, // Disable to avoid conflict
        code: false,
        codeBlock: false,
        heading: false,
        paragraph: false,
        listItem: false,
        orderedList: false,
        bulletList: false,
        blockquote: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
        hardBreak: false,
      }),
      StyledParagraph,
      LineBreak,
      Underline,
      TextAlign.configure({
        types: ['paragraph', 'heading'],
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
      }),
      InlineImage,
      StyledTable.configure({ resizable: false }),
      TableRow,
      StyledTableHeader,
      StyledTableCell,
      FontFamily,
      FontSize,
      Placeholder.configure({
        placeholder: placeholder || 'Write something...',
      }),
    ],
    content: value || '<p style="font-family: Arial, sans-serif; font-size: 12px;"></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base prose-p:my-0 max-w-none focus:outline-none min-h-[250px] p-4 font-serif',
      },
      handleKeyDown: (view, event) => {
        const { state, dispatch } = view;
        const { selection, schema, tr } = state;
        if (event.key === 'Enter') {
          const hardBreak = schema.nodes.hardBreak?.create();
          if (!hardBreak) return false;
          if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
            const insertPos = selection.to;
            tr.insert(insertPos, hardBreak);
            tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
            dispatch(tr);
            return true;
          }
          if (selection instanceof TextSelection && selection.empty) {
            const imageToRight = findImageToRight(state, selection.from);
            if (!imageToRight) return false;
            const insertPos = imageToRight.pos + imageToRight.node.nodeSize;
            tr.insert(insertPos, hardBreak);
            tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
            dispatch(tr);
            return true;
          }
          return false;
        }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
            const pos = event.key === 'ArrowLeft' ? selection.from : selection.to;
            tr.setSelection(TextSelection.create(tr.doc, pos));
            dispatch(tr);
            return true;
          }
          if (selection instanceof TextSelection && selection.empty) {
            if (event.key === 'ArrowLeft') {
              const imageToLeft = findImageToLeft(state, selection.from);
              if (!imageToLeft) return false;
              if (imageToLeft.pos + imageToLeft.node.nodeSize !== selection.from) return false;
              tr.setSelection(TextSelection.create(tr.doc, imageToLeft.pos));
              dispatch(tr);
              return true;
            }
            const imageToRight = findImageToRight(state, selection.from);
            if (!imageToRight) return false;
            if (imageToRight.pos !== selection.from) return false;
            tr.setSelection(TextSelection.create(tr.doc, imageToRight.pos + imageToRight.node.nodeSize));
            dispatch(tr);
            return true;
          }
          return false;
        }
        if (event.key === ' ' || event.code === 'Space') {
          if (selection instanceof NodeSelection && selection.node.type.name === 'image') {
            const insertPos = selection.from;
            tr.insertText('\u00A0', insertPos);
            tr.setSelection(TextSelection.create(tr.doc, insertPos + 1));
            dispatch(tr);
            return true;
          }
          if (selection instanceof TextSelection && selection.empty) {
            const imageToRight = findImageToRight(state, selection.from);
            if (!imageToRight) return false;
            tr.insertText('\u00A0', imageToRight.pos);
            tr.setSelection(TextSelection.create(tr.doc, imageToRight.pos + 1));
            dispatch(tr);
            return true;
          }
          return false;
        }
        if (event.key === 'Backspace') {
          if (selection instanceof NodeSelection && selection.node.type.name === 'image') return false;
          if (selection instanceof TextSelection && selection.empty) {
            const nodeBefore = selection.$from.nodeBefore;
            if (nodeBefore?.type.name !== 'image') return false;
            const deleteFrom = Math.max(0, selection.from - nodeBefore.nodeSize);
            tr.delete(deleteFrom, selection.from);
            tr.setSelection(TextSelection.create(tr.doc, deleteFrom));
            dispatch(tr);
            return true;
          }
          return false;
        }
        return false;
      },
      handlePaste: (view, event) => {
        if (!onFilesDropped) return false;
        const clipboard = event.clipboardData;
        if (!clipboard) return false;
        const files: File[] = [];
        if (clipboard.files && clipboard.files.length > 0) {
          files.push(...Array.from(clipboard.files));
        } else if (clipboard.items && clipboard.items.length > 0) {
          for (const item of Array.from(clipboard.items)) {
            if (item.kind === 'file') {
              const file = item.getAsFile();
              if (file) files.push(file);
            }
          }
        }
        const images = files.filter((file) => file.type.startsWith('image/'));
        if (images.length === 0) return false;
        event.preventDefault();
        onFilesDropped(images, view.state.selection.from);
        return true;
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Handle external updates to value (if any, though usually avoided in controlled editors to prevent cursor jumps)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      // Check if content is actually different to avoid loops
      // Simple check: Only set if editor is empty and value is not
       if (editor.isEmpty && value) {
         editor.commands.setContent(value);
       }
    }
  }, [value, editor]);

  useEffect(() => {
    if (!editor || !onRegisterInsert) return;
    onRegisterInsert((html: string, insertPos?: number) => {
      if (typeof insertPos === 'number') {
        editor.chain().focus().insertContentAt(insertPos, html).run();
        return;
      }
      editor.chain().focus().insertContent(html).run();
    });
  }, [editor, onRegisterInsert]);

  const insertSignature = (signature?: string) => {
    if (editor) {
      const sigContent = signature || '<br><br>--<br><strong>Sent via Ambmail</strong>';
      editor.chain().focus().insertContent(sigContent).run();
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onFilesDropped || !event.dataTransfer?.files?.length) return;
    event.preventDefault();
    setIsDragActive(false);
    setDragDepth(0);
    const insertPos = editor?.state.selection.from;
    onFilesDropped(Array.from(event.dataTransfer.files), insertPos);
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onFilesDropped || !event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    setDragDepth((prev) => prev + 1);
    setIsDragActive(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onFilesDropped || !event.dataTransfer?.types?.includes('Files')) return;
    event.preventDefault();
    setDragDepth((prev) => {
      const next = Math.max(prev - 1, 0);
      if (next === 0) setIsDragActive(false);
      return next;
    });
  };

  return (
    <div
      className="relative flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white"
      onDragOver={(event) => {
        if (onFilesDropped) event.preventDefault();
      }}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {onFilesDropped && (
        <div
          className={`absolute inset-0 z-10 flex items-center justify-center bg-blue-50/90 text-blue-700 text-sm font-semibold transition-opacity duration-200 ${
            isDragActive && dragDepth > 0 ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          Slapp filerna har for att bifoga
        </div>
      )}
      <EditorToolbar
        editor={editor}
        onInsertSignature={() => insertSignature(signature)}
      />
      <div className="flex-1 overflow-y-auto max-h-[500px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
