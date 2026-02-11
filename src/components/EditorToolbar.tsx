'use client';

import { 
  Bold, Italic, Underline, 
  AlignLeft, AlignCenter, AlignRight, 
  List, ListOrdered, 
  Undo, Redo, 
  Link as LinkIcon, Image as ImageIcon, 
  Smile, FileSignature, 
  Eraser, ChevronDown
} from 'lucide-react';
import { Editor } from '@tiptap/react';
import { useState, useRef, useEffect } from 'react';
import EmojiPicker from 'emoji-picker-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: unknown[]) {
  return twMerge(clsx(inputs));
}

interface EditorToolbarProps {
  editor: Editor | null;
  onInsertSignature: (signature?: string) => void;
}

type ToolbarButtonProps = {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  title: string;
  className?: string;
};

function ToolbarButton({
  onClick,
  isActive = false,
  disabled = false,
  children,
  title,
  className,
}: ToolbarButtonProps) {
  return (
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
}

function Divider() {
  return <div className="w-px h-6 bg-gray-200 mx-1 self-center shrink-0" />;
}

export default function EditorToolbar({ editor, onInsertSignature }: EditorToolbarProps) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showFontPicker, setShowFontPicker] = useState(false);
  const [showFontSizePicker, setShowFontSizePicker] = useState(false);
  const [imageWidth, setImageWidth] = useState(320);
  const emojiRef = useRef<HTMLDivElement>(null);
  const colorRef = useRef<HTMLDivElement>(null);
  const fontPickerRef = useRef<HTMLDivElement>(null);
  const fontSizePickerRef = useRef<HTMLDivElement>(null);

  const [emojiPos, setEmojiPos] = useState({ top: 0, left: 0 });
  const [colorPos, setColorPos] = useState({ top: 0, left: 0 });
  const [fontPos, setFontPos] = useState({ top: 0, left: 0 });
  const [fontSizePos, setFontSizePos] = useState({ top: 0, left: 0 });

  const availableFonts = [
    { label: 'Arial', value: 'Arial, sans-serif' },
    { label: 'Times New Roman', value: 'Times New Roman, serif' },
    { label: 'Courier New', value: 'Courier New, monospace' },
    { label: 'Georgia', value: 'Georgia, serif' },
    { label: 'Verdana', value: 'Verdana, sans-serif' },
    { label: 'Helvetica', value: 'Helvetica, sans-serif' }
  ];

  const availableFontSizes = [
    { label: '12px', value: '12px' },
    { label: '16px', value: '16px' },
    { label: '20px', value: '20px' },
    { label: '24px', value: '24px' },
    { label: '32px', value: '32px' }
  ];

  // Hjälpfunktioner för att hämta aktuella attribut
  const getCurrentFontFamily = () => {
    if (!editor) return 'Arial';

    // First check if there's an active textStyle with fontFamily
    const attrs = editor.getAttributes('textStyle');
    if (attrs.fontFamily) {
      // Extract the first font name from the font-family string (before comma)
      const fontFamily = attrs.fontFamily.split(',')[0];
      // Remove quotes if present
      return fontFamily.replace(/['"]/g, '');
    }

    // If no specific font is set, check if any of our available fonts is active
    for (const font of availableFonts) {
      if (editor.isActive('textStyle', { fontFamily: font.value })) {
        return font.label;
      }
    }

    return 'Arial';
  };

  const getCurrentFontSize = () => {
    if (!editor) return '12px';

    const attrs = editor.getAttributes('textStyle');
    if (attrs.fontSize) {
      return attrs.fontSize.replace('px', '') + 'px';
    }

    // If no specific size is set, check if any of our available sizes is active
    for (const size of availableFontSizes) {
      if (editor.isActive('textStyle', { fontSize: size.value })) {
        return size.label;
      }
    }

    return '12px';
  };

  // Använd en tom sträng som tillstånd för att trigga ommålning när redigeraren uppdateras
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    if (!editor) return;

    const syncImageWidth = () => {
      if (!editor.isActive('image')) return;
      const widthAttr = editor.getAttributes('image')?.width;
      const parsed = parseInt(widthAttr, 10);
      if (!Number.isNaN(parsed)) {
        setImageWidth(parsed);
      }
    };

    const handleUpdate = () => {
      forceUpdate(prev => prev + 1);
      syncImageWidth();
    };

    const handleSelectionUpdate = () => {
      forceUpdate(prev => prev + 1);
      syncImageWidth();
    };

    editor.on('update', handleUpdate);
    editor.on('selectionUpdate', handleSelectionUpdate);

    return () => {
      editor.off('update', handleUpdate);
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor]);

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
      if (fontPickerRef.current && !fontPickerRef.current.contains(event.target as Node)) {
        setShowFontPicker(false);
      }
      if (fontSizePickerRef.current && !fontSizePickerRef.current.contains(event.target as Node)) {
        setShowFontSizePicker(false);
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

  const applyImageWidth = (value: number) => {
    const clamped = Math.max(80, Math.min(800, value));
    setImageWidth(clamped);
    editor.chain().focus().updateAttributes('image', { width: `${clamped}px` }).run();
  };

  const clearImageWidth = () => {
    editor.chain().focus().updateAttributes('image', { width: null }).run();
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

  const isImageSelected = editor.isActive('image');

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

      {isImageSelected && (
        <>
          <div className="flex items-center gap-2 shrink-0 px-2">
            <span className="text-xs text-gray-500">Bildstorlek</span>
            <input
              type="range"
              min={80}
              max={800}
              step={10}
              value={imageWidth}
              onChange={(event) => applyImageWidth(Number(event.target.value))}
              className="w-28"
              title="Bildstorlek"
            />
            <input
              type="number"
              min={80}
              max={800}
              value={imageWidth}
              onChange={(event) => applyImageWidth(Number(event.target.value))}
              className="w-16 rounded border border-gray-200 px-2 py-1 text-xs"
            />
            <button
              type="button"
              onClick={clearImageWidth}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Auto
            </button>
          </div>
          <Divider />
        </>
      )}

      {/* Font & Format Group */}
      <div className="flex gap-0.5 shrink-0 items-center">
        <div className="relative">
          <button
            className={cn(
              "p-2 rounded-lg flex items-center gap-1 transition-colors min-h-[32px]",
              (editor?.isActive('textStyle', { fontFamily: getCurrentFontFamily() }) || (editor?.isActive('textStyle') && editor?.getAttributes('textStyle').fontFamily)) ? "bg-blue-50" : "hover:bg-gray-100"
            )}
            title="Font Family"
            onClick={(e) => {
              const button = e.currentTarget;
              const rect = button.getBoundingClientRect();
              setFontPos({ top: rect.bottom + 5, left: rect.left });
              setShowFontPicker(!showFontPicker);
            }}
          >
            <span className="text-sm font-medium" style={{ fontFamily: getCurrentFontFamily() || 'inherit' }}>
              {getCurrentFontFamily()}
            </span>
            <ChevronDown size={12} className="text-gray-500" />
          </button>

          {showFontPicker && (
            <div
              ref={fontPickerRef}
              className="font-picker-dropdown fixed bg-white border border-gray-200 shadow-xl rounded-xl p-2 z-[9999] w-48"
              style={{ top: fontPos.top, left: fontPos.left }}
            >
              {availableFonts.map(font => (
                <button
                  key={font.value}
                  onClick={() => {
                    editor.chain().focus().setFontFamily(font.value).run();
                    setShowFontPicker(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 flex items-center gap-2",
                    editor.isActive('textStyle', { fontFamily: font.value }) ? "bg-blue-100 text-blue-700" : ""
                  )}
                  style={{ fontFamily: font.value }}
                >
                  <span className="text-sm">{font.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="mx-1" />

        <div className="relative">
          <button
            className={cn(
              "p-2 rounded-lg flex items-center gap-1 transition-colors min-h-[32px]",
              (editor?.isActive('textStyle', { fontSize: getCurrentFontSize() }) || (editor?.isActive('textStyle') && editor?.getAttributes('textStyle').fontSize)) ? "bg-blue-50" : "hover:bg-gray-100"
            )}
            title="Font Size"
            onClick={(e) => {
              const button = e.currentTarget;
              const rect = button.getBoundingClientRect();
              setFontSizePos({ top: rect.bottom + 5, left: rect.left });
              setShowFontSizePicker(!showFontSizePicker);
            }}
          >
            <span className="text-sm font-medium">
              {getCurrentFontSize()}
            </span>
            <ChevronDown size={12} className="text-gray-500" />
          </button>

          {showFontSizePicker && (
            <div
              ref={fontSizePickerRef}
              className="font-size-picker-dropdown fixed bg-white border border-gray-200 shadow-xl rounded-xl p-2 z-[9999] w-48"
              style={{ top: fontSizePos.top, left: fontSizePos.left }}
            >
              {availableFontSizes.map(size => (
                <button
                  key={size.value}
                  onClick={() => {
                    editor.chain().focus().setFontSize(size.value).run();
                    setShowFontSizePicker(false);
                  }}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md hover:bg-gray-100 flex items-center gap-2",
                    editor.isActive('textStyle', { fontSize: size.value }) ? "bg-blue-100 text-blue-700" : ""
                  )}
                  style={{ fontSize: size.value }}
                >
                  <span className="text-sm">{size.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

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
      </div>

      <Divider />

      {/* Insert Group */}
      <div className="flex gap-0.5 shrink-0 items-center">
        <ToolbarButton
          onClick={() => onInsertSignature()}
          title="Insert Signature"
        >
          <FileSignature size={18} />
        </ToolbarButton>

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

        
      </div>

      <div className="flex-1" />

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
