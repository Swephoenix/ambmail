'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { TextAlign } from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Link } from '@tiptap/extension-link';
import { Image } from '@tiptap/extension-image';
import { FontFamily } from '@tiptap/extension-font-family';
import { Placeholder } from '@tiptap/extension-placeholder';
import EditorToolbar from './EditorToolbar';
import { useEffect } from 'react';

interface TiptapEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  signature?: string;
}

export default function TiptapEditor({ value, onChange, placeholder, signature }: TiptapEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Link.configure({
        openOnClick: false,
      }),
      Image,
      FontFamily,
      Placeholder.configure({
        placeholder: placeholder || 'Write something...',
      }),
    ],
    content: value || '<p style="font-family: serif"></p>',
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[250px] p-4 font-serif',
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

  const insertSignature = (signature?: string) => {
    if (editor) {
      const sigContent = signature || '<br><br>--<br><strong>Sent via UxMail</strong>';
      editor.chain().focus().insertContent(sigContent).run();
    }
  };

  return (
    <div className="flex flex-col border border-gray-200 rounded-lg overflow-hidden bg-white">
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
