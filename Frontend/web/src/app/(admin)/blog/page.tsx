'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Plus, Edit, Trash2, Eye, EyeOff, FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/guide/RichTextEditor';

// ─── Types ──────────────────────────────────────────────────────────────────

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  tags: string[];
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
  guide: {
    id: string;
    slug: string;
    displayName: string;
    user: { avatarUrl: string | null };
  };
}

interface AuthorOption {
  id: string;                 // guide.id when kind='guide'; user.id when kind='admin'
  kind: 'guide' | 'admin';
  displayName: string;
  avatarUrl: string | null;
  isAdmin: boolean;
}
interface AuthorsResponse {
  guides: AuthorOption[];
  admins: AuthorOption[];
}

type StatusFilter = 'all' | 'published' | 'draft';

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all',       label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft',     label: 'Drafts' },
];

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminBlogPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [guideFilter, setGuideFilter] = useState<string>('');
  const [page, setPage] = useState(1);

  // ─── Fetch posts list ─────────────────────────────────────────────────────
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'blog', page, search, statusFilter, guideFilter],
    queryFn: async () => {
      const { data } = await api.get('/admin/blog', {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: statusFilter,
          guideId: guideFilter || undefined,
        },
      });
      return data as { posts: BlogPost[]; total: number; totalPages: number };
    },
    placeholderData: { posts: [], total: 0, totalPages: 0 },
  });

  // ─── Fetch authors (guides + admin users) ────────────────────────────────
  // Backend returns both buckets: guides (every guide profile, any status) and
  // admins (users with ADMIN/SUPER_ADMIN who don't already have a guide row).
  const { data: authorsData } = useQuery({
    queryKey: ['admin', 'blog', 'authors'],
    queryFn: async () => {
      const { data } = await api.get('/admin/blog/authors');
      return data as AuthorsResponse;
    },
  });
  const authorGuides = useMemo(() => authorsData?.guides ?? [], [authorsData]);
  const authorAdmins = useMemo(() => authorsData?.admins ?? [], [authorsData]);

  // ─── Mutations ────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'blog'] });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, publish }: { id: string; publish: boolean }) =>
      api.patch(`/admin/blog/${id}`, { publish }),
    onSuccess: (_, { publish }) => {
      toast.success(publish ? 'Post published' : 'Post unpublished');
      invalidate();
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? 'Failed to update publish state');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/blog/${id}`),
    onSuccess: () => {
      toast.success('Post deleted');
      invalidate();
    },
    onError: () => toast.error('Failed to delete post'),
  });

  // ─── Modal state ──────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null);

  const openCreate = () => { setEditingPost(null); setModalOpen(true); };
  const openEdit = (post: BlogPost) => { setEditingPost(post); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditingPost(null); };

  const posts = data?.posts ?? [];

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Blog" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-4">

          {/* Filters row */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search title or excerpt…"
                className="pl-9"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
            </div>

            <div className="flex gap-1">
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  onClick={() => { setStatusFilter(f.value); setPage(1); }}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                    statusFilter === f.value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white border text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <select
              value={guideFilter}
              onChange={(e) => { setGuideFilter(e.target.value); setPage(1); }}
              className="rounded-md border bg-white px-3 py-1.5 text-sm text-gray-700"
            >
              <option value="">All authors</option>
              {authorGuides.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.displayName}{g.isAdmin ? ' (Admin)' : ''}
                </option>
              ))}
            </select>

            <div className="ml-auto">
              <button
                onClick={openCreate}
                className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
              >
                <Plus className="h-4 w-4" />
                New Post
              </button>
            </div>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                      <th className="px-4 py-3">Post</th>
                      <th className="px-4 py-3">Author (Guide)</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Published</th>
                      <th className="px-4 py-3">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {isLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-24" /></td>
                          ))}
                        </tr>
                      ))
                    ) : posts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                          <FileText className="mx-auto mb-2 h-8 w-8 opacity-40" />
                          No blog posts match these filters.
                        </td>
                      </tr>
                    ) : (
                      posts.map((post) => (
                        <tr key={post.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {post.coverImageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={post.coverImageUrl} alt="" className="h-10 w-14 rounded object-cover" />
                              ) : (
                                <div className="flex h-10 w-14 items-center justify-center rounded bg-gray-100 text-gray-400">
                                  <FileText className="h-4 w-4" />
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-gray-900">{post.title}</p>
                                {post.tags.length > 0 && (
                                  <div className="mt-0.5 flex flex-wrap gap-1">
                                    {post.tags.slice(0, 3).map((t) => (
                                      <span key={t} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600">{t}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {post.guide.user.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={post.guide.user.avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                              ) : (
                                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-600">
                                  {post.guide.displayName[0]}
                                </div>
                              )}
                              <span className="text-gray-700">{post.guide.displayName}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {post.isPublished ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100 gap-1">
                                <Eye className="h-3 w-3" /> Published
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 gap-1">
                                <EyeOff className="h-3 w-3" /> Draft
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(post.publishedAt)}</td>
                          <td className="px-4 py-3 text-gray-600">{fmtDate(post.createdAt)}</td>
                          <td className="px-4 py-3">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => togglePublishMutation.mutate({ id: post.id, publish: !post.isPublished })}
                                disabled={togglePublishMutation.isPending}
                                title={post.isPublished ? 'Unpublish' : 'Publish'}
                                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
                              >
                                {post.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={() => openEdit(post)}
                                title="Edit"
                                className="rounded p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(`Delete "${post.title}"? This cannot be undone.`)) {
                                    deleteMutation.mutate(post.id);
                                  }
                                }}
                                disabled={deleteMutation.isPending}
                                title="Delete"
                                className="rounded p-1.5 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {(data?.totalPages ?? 0) > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <p className="text-xs text-gray-500">
                    {data?.total} posts · Page {page} of {data?.totalPages}
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="rounded border px-3 py-1 text-xs disabled:opacity-40">
                      Previous
                    </button>
                    <button onClick={() => setPage((p) => p + 1)} disabled={page >= (data?.totalPages ?? 1)}
                      className="rounded border px-3 py-1 text-xs disabled:opacity-40">
                      Next
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <PostModal
          existing={editingPost}
          authorGuides={authorGuides}
          authorAdmins={authorAdmins}
          onClose={closeModal}
          onSaved={() => { closeModal(); invalidate(); }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE / EDIT MODAL
// ═══════════════════════════════════════════════════════════════════════════

// Dropdown value format: "<kind>:<id>" so we can round-trip kind cleanly through
// a single <select>. Parsed at submit time.
function encodeAuthor(kind: 'guide' | 'admin', id: string) { return `${kind}:${id}`; }
function decodeAuthor(v: string): { kind: 'guide' | 'admin'; id: string } | null {
  const [kind, ...rest] = v.split(':');
  const id = rest.join(':');
  if ((kind !== 'guide' && kind !== 'admin') || !id) return null;
  return { kind, id };
}

function PostModal({
  existing, authorGuides, authorAdmins, onClose, onSaved,
}: {
  existing: BlogPost | null;
  authorGuides: AuthorOption[];
  authorAdmins: AuthorOption[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [authorValue, setAuthorValue] = useState(
    existing ? encodeAuthor('guide', existing.guide.id) : '',
  );
  const [title, setTitle] = useState(existing?.title ?? '');
  const [excerpt, setExcerpt] = useState(existing?.excerpt ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [tagsInput, setTagsInput] = useState((existing?.tags ?? []).join(', '));
  const [coverImageUrl, setCoverImageUrl] = useState(existing?.coverImageUrl ?? '');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [saving, setSaving] = useState(false);

  // Default to first available author when creating
  useEffect(() => {
    if (existing || authorValue) return;
    if (authorGuides.length > 0) {
      setAuthorValue(encodeAuthor('guide', authorGuides[0].id));
    } else if (authorAdmins.length > 0) {
      setAuthorValue(encodeAuthor('admin', authorAdmins[0].id));
    }
  }, [existing, authorValue, authorGuides, authorAdmins]);

  const isEdit = !!existing;

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error('Cover image must be under 5MB'); return; }

    setUploadingCover(true);
    try {
      const { data: presigned } = await api.get('/upload/presigned-url', {
        params: { folder: 'guide-media', fileName: file.name, contentType: file.type },
      });
      const putRes = await fetch(presigned.uploadUrl, {
        method: 'PUT', body: file, headers: { 'Content-Type': file.type },
      });
      if (!putRes.ok) throw new Error(`S3 upload failed (${putRes.status})`);
      setCoverImageUrl(presigned.fileUrl);
      toast.success('Cover image uploaded');
    } catch (err: any) {
      toast.error(err?.message ?? 'Cover upload failed');
    } finally {
      setUploadingCover(false);
    }
  };

  const submit = async (publish: boolean) => {
    const parsed = decodeAuthor(authorValue);
    if (!parsed) { toast.error('Pick an author'); return; }
    if (title.trim().length < 3) { toast.error('Title must be at least 3 characters'); return; }
    if (content.trim().length < 10) { toast.error('Content is too short'); return; }
    if (publish && !coverImageUrl) { toast.error('A cover image is required to publish'); return; }

    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    const payload: any = {
      authorId: parsed.id,
      authorKind: parsed.kind,
      title: title.trim(),
      content,
      excerpt: excerpt.trim() || undefined,
      tags,
      coverImageUrl: coverImageUrl || undefined,
      publish,
    };

    setSaving(true);
    try {
      if (isEdit) await api.patch(`/admin/blog/${existing!.id}`, payload);
      else await api.post('/admin/blog', payload);
      toast.success(publish ? 'Post published' : isEdit ? 'Post saved' : 'Draft created');
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">{isEdit ? 'Edit Post' : 'New Blog Post'}</h2>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Author
              </label>
              <select
                value={authorValue}
                onChange={(e) => setAuthorValue(e.target.value)}
                className="w-full rounded-md border bg-white px-3 py-2 text-sm"
              >
                <option value="">— Choose an author —</option>
                {authorGuides.length > 0 && (
                  <optgroup label="Guides">
                    {authorGuides.map((g) => (
                      <option key={`guide:${g.id}`} value={encodeAuthor('guide', g.id)}>
                        {g.displayName}{g.isAdmin ? ' (also an admin)' : ''}
                      </option>
                    ))}
                  </optgroup>
                )}
                {authorAdmins.length > 0 && (
                  <optgroup label="Admin users">
                    {authorAdmins.map((a) => (
                      <option key={`admin:${a.id}`} value={encodeAuthor('admin', a.id)}>
                        {a.displayName} (Admin)
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
              <p className="mt-1 text-[11px] text-gray-500">
                Posts live at <code>/journal/{'{guide-slug}'}/{'{post-slug}'}</code>. Selecting an admin user
                auto-creates an editorial profile for them on first publish (unpublished so it stays out of the
                public guide directory).
              </p>
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Title</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="A compelling headline…" />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Excerpt <span className="text-gray-400 normal-case">(optional — first 200 chars of content if blank)</span>
              </label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                maxLength={500}
                className="w-full rounded-md border px-3 py-2 text-sm"
                placeholder="A short teaser shown on the Journal listing and in carousels."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                Tags <span className="text-gray-400 normal-case">(comma-separated)</span>
              </label>
              <Input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="meditation, mindfulness"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Cover Image</label>
              <div className="flex items-center gap-3">
                {coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={coverImageUrl} alt="" className="h-10 w-14 rounded object-cover" />
                ) : (
                  <div className="flex h-10 w-14 items-center justify-center rounded border border-dashed bg-gray-50 text-gray-400">
                    <FileText className="h-4 w-4" />
                  </div>
                )}
                <label className="cursor-pointer rounded-md border bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                  {uploadingCover ? 'Uploading…' : coverImageUrl ? 'Replace' : 'Upload'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleCoverUpload}
                    disabled={uploadingCover}
                    className="hidden"
                  />
                </label>
                {coverImageUrl && !uploadingCover && (
                  <button
                    type="button"
                    onClick={() => setCoverImageUrl('')}
                    className="text-xs text-gray-500 hover:text-red-600"
                  >
                    Remove
                  </button>
                )}
              </div>
              <p className="mt-1 text-[11px] text-gray-500">Required to publish. JPG/PNG/WebP, max 5MB.</p>
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">Content</label>
              <RichTextEditor value={content} onChange={setContent} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
          <div className="text-xs text-gray-500">
            {isEdit && existing?.isPublished
              ? 'This post is live. Saving without publish keeps it live.'
              : 'Save as draft any time. Publish when ready.'}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              onClick={() => submit(false)}
              disabled={saving || uploadingCover}
              className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Save as Draft
            </button>
            <button
              onClick={() => submit(true)}
              disabled={saving || uploadingCover}
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit && existing?.isPublished ? 'Update & Keep Live' : 'Publish'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
