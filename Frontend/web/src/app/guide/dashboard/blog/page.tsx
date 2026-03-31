'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, formatDate, PageHeader, Panel, Btn, EmptyState, StatusBadge, Modal, FormGroup, Input } from '@/components/guide/dashboard-ui';
import { RichTextEditor } from '@/components/guide/RichTextEditor';

interface BlogPost {
  id: string; title: string; content: string; excerpt: string | null;
  coverImageUrl: string | null; isPublished: boolean;
  publishedAt: string | null; createdAt: string;
}

const emptyForm = { title: '', content: '', excerpt: '' };

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [loadingPost, setLoadingPost] = useState(false);

  const load = () => api.get('/blog/mine').then(r => setPosts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setCoverPreview(null);
    setShowModal(true);
  };

  // Convert Tiptap JSON content to HTML if needed
  const normalizeContent = (raw: string): string => {
    if (!raw) return '';
    // If content is JSON (Tiptap format from seed), convert to basic HTML
    if (raw.startsWith('{') || raw.startsWith('[')) {
      try {
        const doc = JSON.parse(raw);
        if (doc.type === 'doc' && Array.isArray(doc.content)) {
          return doc.content.map((node: any) => {
            const text = node.content?.map((c: any) => c.text || '').join('') || '';
            if (node.type === 'heading') return `<h2>${text}</h2>`;
            if (node.type === 'paragraph') return `<p>${text}</p>`;
            return `<p>${text}</p>`;
          }).join('');
        }
      } catch { /* not valid JSON, use as-is */ }
    }
    return raw;
  };

  const openEdit = async (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      content: normalizeContent(post.content || ''),
      excerpt: post.excerpt || '',
    });
    setCoverPreview(post.coverImageUrl || null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setCoverPreview(null);
  };

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCoverPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
    toast.info('Cover image selected. S3 upload will be wired when AWS keys are configured.');
  };

  const save = async (publish: boolean) => {
    if (publish && !coverPreview) {
      toast.error('A cover image is required to publish. Please upload a cover image.');
      return;
    }
    try {
      if (editingId) {
        // Update existing post
        await api.put(`/blog/${editingId}`, {
          title: form.title || undefined,
          content: form.content || undefined,
          excerpt: form.excerpt || undefined,
          coverImageUrl: coverPreview || undefined,
          publish,
        });
        toast.success(publish ? 'Post published!' : 'Post updated');
      } else {
        // Create new post
        await api.post('/blog', {
          title: form.title,
          content: form.content,
          excerpt: form.excerpt || undefined,
          coverImageUrl: coverPreview || undefined,
          publish,
        });
        toast.success(publish ? 'Post published!' : 'Draft saved');
      }
      closeModal();
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to save post');
    }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/blog/${id}`); setPosts(p => p.filter(x => x.id !== id)); toast.success('Post deleted'); } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <PageHeader title="My Blog" subtitle="Share your wisdom, insights, and updates. One post per 24 hours.">
        <Btn onClick={openCreate}>+ Write New Post</Btn>
      </PageHeader>
      <Panel title="Your Posts" icon="✍️">
        {posts.length === 0 ? <EmptyState message="No blog posts yet. Write your first post!" /> : posts.map(post => (
          <div key={post.id} style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
            <div style={{ width: '72px', height: '54px', borderRadius: '6px', background: C.goldPale, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {post.coverImageUrl ? (
                post.coverImageUrl.startsWith('data:')
                  ? <img src={post.coverImageUrl} alt="" style={{ width: '72px', height: '54px', objectFit: 'cover' }} />
                  : <Image src={post.coverImageUrl} alt="" width={72} height={54} className="object-cover" />
              ) : <span style={{ fontSize: '24px' }}>✍️</span>}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal, marginBottom: '3px' }}>{post.title}</div>
              <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{post.isPublished ? `Published · ${formatDate(post.publishedAt!)}` : `Draft · ${formatDate(post.createdAt)}`}</div>
            </div>
            <StatusBadge published={post.isPublished} />
            <Btn variant="secondary" size="sm" onClick={() => openEdit(post)}>Edit</Btn>
            <Btn variant="danger" size="sm" onClick={() => remove(post.id)}>Delete</Btn>
          </div>
        ))}
      </Panel>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal} title={editingId ? 'Edit Post' : 'Write New Post'} maxWidth="700px">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <FormGroup label="Post Title">
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Give your post a compelling title..." />
          </FormGroup>

          {/* Cover Image — required for publishing */}
          <FormGroup label="Cover Image (required to publish)">
            {coverPreview && coverPreview.startsWith('data:') && (
              <div style={{ marginBottom: '10px', borderRadius: '8px', overflow: 'hidden', maxHeight: '160px' }}>
                <img src={coverPreview} alt="Preview" style={{ width: '100%', height: '160px', objectFit: 'cover', borderRadius: '8px' }} />
              </div>
            )}
            <label style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 16px', fontFamily: font, fontSize: '12px', fontWeight: 500,
              background: C.goldPale, border: '1.5px solid rgba(232,184,75,0.5)',
              borderRadius: '6px', cursor: 'pointer', color: C.charcoal,
            }}>
              📁 {coverPreview ? 'Change Cover Image' : 'Upload Cover Image'}
              <input type="file" accept="image/*" onChange={handleCoverSelect} style={{ display: 'none' }} />
            </label>
          </FormGroup>

          {/* Rich Text Content */}
          <FormGroup label="Content">
            <RichTextEditor
              value={form.content}
              onChange={(html) => setForm(f => ({ ...f, content: html }))}
              placeholder="Write your post..."
              minHeight="200px"
              extended
            />
          </FormGroup>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Btn variant="secondary" onClick={() => save(false)}>
            {editingId ? 'Save as Draft' : 'Save as Draft'}
          </Btn>
          <Btn onClick={() => save(true)}>
            {editingId ? 'Update & Publish' : 'Publish Post'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
