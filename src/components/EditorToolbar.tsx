'use client';

import { 
  Bold, Italic, Underline, 
  AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, Quote, 
  Undo, Redo, 
  Link as LinkIcon, Image as ImageIcon, 
  Smile, HardDrive, Lock, FileSignature, 
  MoreHorizontal, Eraser, Type, ChevronDown
} from 'lucide-react';
import { Editor } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: any[]) {
  return twMerge(clsx(inputs));
}

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertSignature: (signature?: string) => void;
}

export default function EditorToolbar({ editor, onInsertSignature }: EditorToolbarProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const emojiRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);

  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });
  const [colorPos, setColorPos] = useState({ top: 0, left: 0 });

  const toggleEmojiPicker = () => {
    if (emojiRef.current) {
      const rect = emojiRef.current.getBoundingClientRect();
      setEmojiPos({ top: rect.bottom + 5, left: rect.left });
    }
    setShowEmojiPicker(!showEmojiPicker);
  };

  const toggleColorPicker = () => {
    if (colorRef.current) {
      const rect = colorRef.current.getBoundingClientRect();
      setColorPos({ top: rect.bottom + 5, left: rect.left });
    }
    setShowColorPicker(!showColorPicker);
  };

  // Close popups when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (emojiRef.current && !emojiRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
      if (colorRef.current && !colorRef.current.contains(event.target as Node)) {
        setShowColorPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  if (!editor) {
    return null;
  }

  const addImage = () => {
    const url = window.prompt('URL');
    if (url) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const ToolbarButton = ({ 
    onClick, 
    isActive = false, 
    disabled = false, 
    children, 
    title,
    className 
  }: { 
    onClick: () => void, 
    isActive?: boolean, 
    disabled?: boolean, 
    children: React.ReactNode, 
    title: string,
    className?: string
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "p-2 rounded-lg transition-colors flex items-center justify-center min-w-[32px] min-h-[32px]",
        isActive 
          ? "bg-blue-100 text-blue-700" 
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        disabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-gray-600",
        className
      )}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-gray-200 mx-1 self-center shrink-0" />;

  return (
    <div className="border-b border-gray-200 bg-white p-2 flex items-center gap-1 sticky top-0 z-10 overflow-x-auto no-scrollbar shadow-sm">
      
      {/* History Group */}
      <div className="flex gap-0.5 shrink-0">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().chain().focus().undo().run()}
          title="Undo"
        >
          <Undo size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().chain().focus().redo().run()}
          title="Redo"
        >
          <Redo size={18} />
        </ToolbarButton>
      </div>

      <Divider />

      {/* Font & Format Group */}
      <div className="flex gap-0.5 shrink-0 items-center">
        <ToolbarButton
          onClick={() => editor.chain().focus().setFontFamily('Inter').run()}
          isActive={editor.isActive('textStyle', { fontFamily: 'Inter' })}
          title="Sans Serif (Inter)"
        >
          <span className="font-sans text-sm font-bold">A</span>
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setFontFamily('Times New Roman, serif').run()}
          isActive={editor.isActive('textStyle', { fontFamily: 'Times New Roman, serif' }) || editor.isActive('textStyle', { fontFamily: 'serif' })}
          title="Serif (Times New Roman)"
        >
          <span className="font-serif text-sm font-bold">T</span>
        </ToolbarButton>
        
        <div className="mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Bold"
        >
          <Bold size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Italic"
        >
          <Italic size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Underline"
        >
          <Underline size={18} />
        </ToolbarButton>
        
        <div className="relative" ref={colorRef}>
          <button
             onClick={toggleColorPicker}
             className={cn(
               "p-2 rounded-lg flex items-center gap-1 transition-colors min-h-[32px]",
               editor.isActive('textStyle') ? "bg-blue-50" : "hover:bg-gray-100"
             )}
             title="Text Color"
          >
            <div 
              className="w-4 h-4 rounded-full border border-gray-300 shadow-sm" 
              style={{ backgroundColor: editor.getAttributes('textStyle').color || '#000000' }} 
            />
            <ChevronDown size={12} className="text-gray-500" />
          </button>
          {showColorPicker && (
            <div 
              className="fixed bg-white border border-gray-200 shadow-xl rounded-xl p-3 grid grid-cols-5 gap-2 z-[9999] w-48 animate-in fade-in zoom-in-95 duration-100"
              style={{ top: colorPos.top, left: colorPos.left }}
            >
               {['#000000', '#444444', '#888888', '#d32f2f', '#f57c00', '#fbc02d', '#388e3c', '#1976d2', '#7b1fa2', '#c2185b'].map(color => (
                 <button
                   key={color}
                   onClick={() => {
                     editor.chain().focus().setColor(color).run();
                     setShowColorPicker(false);
                   }}
                   className="w-6 h-6 rounded-full border border-gray-200 hover:scale-110 transition-transform ring-offset-2 hover:ring-2 ring-blue-500"
                   style={{ backgroundColor: color }}
                   title={color}
                 />
               ))}
            </div>
          )}
        </div>
      </div>

      <Divider />

      {/* Paragraph Group */}
      <div className="flex gap-0.5 shrink-0">
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          isActive={editor.isActive({ textAlign: 'left' })}
          title="Align Left"
        >
          <AlignLeft size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          isActive={editor.isActive({ textAlign: 'center' })}
          title="Align Center"
        >
          <AlignCenter size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          isActive={editor.isActive({ textAlign: 'right' })}
          title="Align Right"
        >
          <AlignRight size={18} />
        </ToolbarButton>
        
        <div className="mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Bullet List"
        >
          <List size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Ordered List"
        >
          <ListOrdered size={18} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Blockquote"
        >
          <Quote size={18} />
        </ToolbarButton>
      </div>

      <Divider />

      {/* Insert Group */}
      <div className="flex gap-0.5 shrink-0 items-center">
        <ToolbarButton
          onClick={setLink}
          isActive={editor.isActive('link')}
          title="Insert Link"
        >
          <LinkIcon size={18} />
        </ToolbarButton>
        
        <div className="relative" ref={emojiRef}>
          <ToolbarButton
            onClick={toggleEmojiPicker}
            isActive={showEmojiPicker}
            title="Emoji"
          >
            <Smile size={18} />
          </ToolbarButton>
          {showEmojiPicker && (
             <div 
               className="fixed z-[9999]"
               style={{ top: emojiPos.top, left: emojiPos.left }}
             >
               <div className="relative shadow-2xl rounded-xl overflow-hidden border border-gray-200">
                  {typeof window !== 'undefined' && (
                    <EmojiPicker 
                      onEmojiClick={(emojiData) => {
                        editor.chain().focus().insertContent(emojiData.emoji).run();
                        setShowEmojiPicker(false);
                      }} 
                      width={320}
                      height={400}
                    />
                  )}
               </div>
             </div>
          )}
        </div>

        <ToolbarButton
          onClick={addImage}
          title="Insert Image"
        >
          <ImageIcon size={18} />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => alert("Drive integration coming soon!")}
          title="Insert from Drive"
        >
          <HardDrive size={18} />
        </ToolbarButton>
        
        <ToolbarButton
          onClick={() => onInsertSignature()}
          title="Insert Signature"
        >
          <FileSignature size={18} />
        </ToolbarButton>
      </div>

      <div className="flex-1" />
      
      <Divider />

      {/* Utils Group */}
       <div className="flex gap-0.5 shrink-0">
         <ToolbarButton
            onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
            title="Clear Formatting"
          >
            <Eraser size={18} />
          </ToolbarButton>
       </div>

    </div>
  );
}