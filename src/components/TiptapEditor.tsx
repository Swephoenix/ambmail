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
import { FontSize } from './extensions/FontSize';
import EditorToolbar from './EditorToolbar';
import { useEffect, useState } from 'react';

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  signature?: string;
  onRegisterInsert?: (insert: (html: string) => void) => void;
  onFilesDropped?: (files: File[]) => void;
}

export default function TiptapEditor({ value, onChange, placeholder, signature, onRegisterInsert, onFilesDropped }: TiptapEditorProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [dragDepth, setDragDepth] = useState(0);
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
        listItem: false,
        orderedList: false,
        bulletList: false,
        blockquote: false,
        horizontalRule: false,
        dropcursor: false,
        gapcursor: false,
        hardBreak: false,
      }),
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
      Image,
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
    onRegisterInsert((html: string) => {
      editor.chain().focus().insertContent(html).run();
    });
  }, [editor, onRegisterInsert]);

  const insertSignature = (signature?: string) => {
    if (editor) {
      const sigContent = signature || '<br><br>--<br><strong>Sent via UxMail</strong>';
      editor.chain().focus().insertContent(sigContent).run();
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!onFilesDropped || !event.dataTransfer?.files?.length) return;
    event.preventDefault();
    setIsDragActive(false);
    setDragDepth(0);
    onFilesDropped(Array.from(event.dataTransfer.files));
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
            isDragActive ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
