'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Youtube from '@tiptap/extension-youtube';
import TiptapImage from '@tiptap/extension-image';
import { useEffect } from 'react';
import { C } from './dashboard-ui';
import { staticPageBlockExtensions } from './richtext/staticPageBlocks';

const font = "var(--font-inter), 'Inter', sans-serif";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: string;
  /** Show extended toolbar: H2, YouTube embed, Image insert */
  extended?: boolean;
  /**
   * Enable the static-page rich-layout block extensions (pillar +
   * steps-box cards) plus their insertion toolbar buttons. Used by
   * /admin/static-pages so editing the /mission and similar branded
   * pages doesn't strip the card markup on save. Intentionally OFF
   * for blog / event / tour editors that don't need these blocks.
   */
  staticPageBlocks?: boolean;
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        padding: '4px 8px',
        fontSize: '12px',
        fontWeight: 600,
        background: active ? C.goldPale : C.white,
        border: `1px solid ${active ? C.gold : 'rgba(232,184,75,0.3)'}`,
        borderRadius: '4px',
        cursor: 'pointer',
        color: C.charcoal,
        fontFamily: font,
        transition: 'background 0.2s',
      }}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Start writing...',
  minHeight = '140px',
  extended = false,
  staticPageBlocks = false,
}: RichTextEditorProps) {
  // Static-page blocks need H3 for the .steps-box heading slot, so they
  // unlock heading level 3 even when the regular `extended` mode hasn't
  // unlocked H2. Both can coexist.
  const headingLevels = staticPageBlocks
    ? extended
      ? [2, 3]
      : [3]
    : extended
      ? [2]
      : false;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: headingLevels ? { levels: headingLevels as any } : false,
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
      }),
      Underline,
      ...(extended
        ? [
            Youtube.configure({
              width: 640,
              height: 360,
              nocookie: true,
            }),
            TiptapImage.configure({
              inline: false,
              allowBase64: true,
            }),
          ]
        : []),
      ...(staticPageBlocks ? staticPageBlockExtensions : []),
    ],
    content: value,
    onUpdate: ({ editor: ed }) => {
      onChange(ed.getHTML());
    },
    editorProps: {
      attributes: {
        style: `
          font-family: ${font};
          font-size: 13px;
          color: ${C.charcoal};
          line-height: 1.6;
          outline: none;
          min-height: ${minHeight};
          padding: 12px 14px;
        `,
      },
    },
  });

  // Sync external value changes (e.g. form reset)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  // Hidden file input ref for image upload
  const imageInputId = `rte-img-${Math.random().toString(36).slice(2, 8)}`;

  if (!editor) return null;

  const insertYouTube = () => {
    const url = prompt('Paste a YouTube video URL:');
    if (!url) return;
    editor.chain().focus().setYoutubeVideo({ src: url }).run();
  };

  // ── Static-page block inserters ────────────────────────────────────────
  // Each inserts a fully-shaped block (matches the node schema's strict
  // content) so admin can edit the prose without worrying about which
  // child slots are required.
  const insertPillar = () => {
    editor.chain().focus().insertContent({
      type: 'pillar',
      content: [
        { type: 'pillarIcon', content: [{ type: 'text', text: '✦' }] },
        { type: 'pillarTitle', content: [{ type: 'text', text: 'Commitment title' }] },
        { type: 'pillarText', content: [{ type: 'text', text: 'A short description of this commitment.' }] },
      ],
    }).run();
  };

  const insertStepsBox = () => {
    const makeStep = (num: string, title: string) => ({
      type: 'step',
      content: [
        { type: 'stepNum', content: [{ type: 'text', text: num }] },
        {
          type: 'stepBody',
          content: [
            { type: 'stepTitle', content: [{ type: 'text', text: title }] },
            { type: 'stepText', content: [{ type: 'text', text: 'Describe this step.' }] },
          ],
        },
      ],
    });
    editor.chain().focus().insertContent({
      type: 'stepsBox',
      content: [
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'How it works' }],
        },
        makeStep('1', 'First step'),
        makeStep('2', 'Second step'),
        makeStep('3', 'Third step'),
      ],
    }).run();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const src = ev.target?.result as string;
      editor.chain().focus().setImage({ src }).run();
      // TODO: Replace base64 with S3 URL after uploading via pre-signed URL
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = '';
  };

  return (
    <div>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          flexWrap: 'wrap',
          padding: '8px 10px',
          background: C.offWhite,
          border: '1.5px solid rgba(232,184,75,0.3)',
          borderBottom: 'none',
          borderRadius: '8px 8px 0 0',
        }}
      >
        <ToolbarButton
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Bold"
        >
          <b>B</b>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Italic"
        >
          <i>I</i>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title="Underline"
        >
          <u>U</u>
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Bullet List"
        >
          • List
        </ToolbarButton>
        <ToolbarButton
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Numbered List"
        >
          1. List
        </ToolbarButton>

        {/* Extended toolbar buttons — only for blog posts */}
        {extended && (
          <>
            <ToolbarButton
              active={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              title="Heading 2"
            >
              H2
            </ToolbarButton>
            <ToolbarButton
              onClick={insertYouTube}
              title="Embed YouTube Video"
            >
              ▶ YouTube
            </ToolbarButton>
            <ToolbarButton
              onClick={() => document.getElementById(imageInputId)?.click()}
              title="Upload & Insert Image"
            >
              🖼 Image
            </ToolbarButton>
          </>
        )}

        {/* Static-page block inserters — only when the editor is in
            static-page mode (admin /admin/static-pages). */}
        {staticPageBlocks && (
          <>
            <ToolbarButton
              onClick={insertPillar}
              title="Insert a pillar/commitment card"
            >
              ✦ Pillar
            </ToolbarButton>
            <ToolbarButton
              onClick={insertStepsBox}
              title="Insert a numbered steps box"
            >
              ❶ Steps
            </ToolbarButton>
          </>
        )}
      </div>

      {/* Editor */}
      <div
        style={{
          background: C.offWhite,
          border: '1.5px solid rgba(232,184,75,0.3)',
          borderTop: 'none',
          borderRadius: '0 0 8px 8px',
          minHeight,
        }}
      >
        <EditorContent editor={editor} />
      </div>

      {/* Hidden file input for image upload */}
      {extended && (
        <input
          id={imageInputId}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />
      )}

      {/* Tiptap styles — override Tailwind Preflight reset */}
      <style>{`
        .tiptap {
          outline: none;
          min-height: ${minHeight};
        }
        .tiptap p {
          margin: 0 0 0.5em 0;
        }
        .tiptap h2 {
          font-family: var(--font-cormorant-garamond), 'Cormorant Garamond', serif;
          font-size: 24px;
          font-weight: 500;
          color: ${C.charcoal};
          margin: 1em 0 0.5em 0;
        }
        .tiptap ul {
          list-style-type: disc !important;
          padding-left: 1.5em !important;
          margin: 0.5em 0 !important;
        }
        .tiptap ol {
          list-style-type: decimal !important;
          padding-left: 1.5em !important;
          margin: 0.5em 0 !important;
        }
        .tiptap li {
          margin: 0.2em 0;
          display: list-item !important;
        }
        .tiptap li p {
          margin: 0;
        }
        .tiptap img {
          max-width: 100%;
          height: auto;
          border-radius: 8px;
          margin: 12px 0;
        }
        .tiptap div[data-youtube-video] {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
          overflow: hidden;
          border-radius: 8px;
          margin: 12px 0;
        }
        .tiptap div[data-youtube-video] iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          border: none;
          border-radius: 8px;
        }
        .tiptap p.is-editor-empty:first-child::before {
          content: '${placeholder}';
          color: ${C.warmGray};
          font-style: italic;
          pointer-events: none;
          float: left;
          height: 0;
        }

        /* ── Static-page card visuals inside the editor ────────────────
           Mirrors the public StaticPageRenderer's pillar + steps-box
           styling so admin sees a faithful preview of what publishes.
           Only emitted when staticPageBlocks={true} on the editor.    */
        .tiptap .pillar {
          display: grid;
          grid-template-columns: 52px 1fr;
          grid-template-areas: "icon title" "icon text";
          column-gap: 20px;
          align-items: start;
          margin: 12px 0;
          padding: 20px;
          background: #FFFFFF;
          border-radius: 12px;
          border-left: 3px solid ${C.gold};
        }
        .tiptap .pillar-icon {
          grid-area: icon;
          width: 48px; height: 48px;
          background: rgba(232,184,75,0.1);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
        }
        .tiptap .pillar-title {
          grid-area: title;
          font-family: var(--font-cormorant-garamond), 'Cormorant Garamond', serif;
          font-size: 18px; font-weight: 500;
          color: ${C.charcoal};
          margin: 0 0 4px;
        }
        .tiptap .pillar-text {
          grid-area: text;
          font-size: 13px;
          color: ${C.warmGray};
          line-height: 1.6;
          margin: 0;
        }
        .tiptap .steps-box {
          background: #FFFFFF;
          border-radius: 12px;
          padding: 24px;
          margin: 12px 0;
        }
        .tiptap .steps-box h3 {
          font-family: var(--font-cormorant-garamond), 'Cormorant Garamond', serif;
          font-size: 20px; font-weight: 500;
          color: ${C.charcoal};
          margin: 0 0 16px;
        }
        .tiptap .step {
          display: flex; gap: 14px;
          align-items: flex-start;
          margin-bottom: 14px;
        }
        .tiptap .step:last-child { margin-bottom: 0; }
        .tiptap .step-num {
          width: 28px; height: 28px;
          background: ${C.gold};
          color: #FFFFFF;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: 600;
          flex-shrink: 0;
        }
        .tiptap .step-body { flex: 1; }
        .tiptap .step-body .step-title,
        .tiptap .step-body strong {
          display: block;
          font-size: 14px; font-weight: 600;
          color: ${C.charcoal};
          margin: 0 0 3px;
        }
        .tiptap .step-body .step-text,
        .tiptap .step-body span {
          display: block;
          font-size: 13px;
          color: ${C.warmGray};
          line-height: 1.55;
          margin: 0;
        }
      `}</style>
    </div>
  );
}
