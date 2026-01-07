import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /**
       * Set the font size attribute
       */
      setFontSize: (size: string) => ReturnType;
      /**
       * Unset the font size attribute
       */
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return {
      types: ['textStyle'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element) => element.style.fontSize || element.getAttribute('data-font-size'),
            renderHTML: (attributes) => {
              if (!attributes.fontSize) {
                return {};
              }

              return { 'data-font-size': attributes.fontSize, style: `font-size: ${attributes.fontSize};` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize: (size: string) => ({ commands }) => {
        return commands.setMark('textStyle', { fontSize: size });
      },
      unsetFontSize: () => ({ commands }) => {
        return commands.setMark('textStyle', { fontSize: null });
      },
    };
  },
});