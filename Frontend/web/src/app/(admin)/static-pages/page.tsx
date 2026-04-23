'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { AdminHeader } from '@/components/admin/header';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Edit, Trash2, Eye, EyeOff, FileText, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/guide/RichTextEditor';

// ─── Types ──────────────────────────────────────────────────────────────────

interface StaticPageSummary {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  createdAt: string;
}

interface StaticPageFull extends StaticPageSummary {
  metaTitle: string | null;
  metaDescription: string | null;
  eyebrow: string | null;
  subtitle: string | null;
  body: string;
}

interface UpsertPayload {
  slug: string;
  title: string;
  metaTitle?: string;
  metaDescription?: string;
  eyebrow?: string;
  subtitle?: string;
  body: string;
  isPublished: boolean;
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════

export default function AdminStaticPagesPage() {
  const queryClient = useQueryClient();
  const [editorState, setEditorState] = useState<
    | { mode: 'closed' }
    | { mode: 'create' }
    | { mode: 'edit'; id: string }
  >({ mode: 'closed' });

  const { data: pages = [], isLoading } = useQuery<StaticPageSummary[]>({
    queryKey: ['admin', 'static-pages'],
    queryFn: async () => {
      const { data } = await api.get('/admin/static-pages');
      return data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => api.delete(`/admin/static-pages/${id}`),
    onSuccess: () => {
      toast.success('Page deleted');
      queryClient.invalidateQueries({ queryKey: ['admin', 'static-pages'] });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to delete page');
    },
  });

  return (
    <div className="flex flex-col overflow-hidden">
      <AdminHeader title="Static Pages (CMS)" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">
                Edit the copy for public legal + marketing pages. Pages render
                at <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">/[slug]</code>.
              </p>
            </div>
            <button
              onClick={() => setEditorState({ mode: 'create' })}
              className="inline-flex items-center gap-2 rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700"
            >
              <Plus className="h-4 w-4" /> New Page
            </button>
          </div>

          {/* Table */}
          <Card>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-2 p-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : pages.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 p-12 text-center">
                  <FileText className="h-10 w-10 text-gray-300" />
                  <p className="text-sm text-gray-500">
                    No static pages yet. Create one to get started.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Title</th>
                        <th className="px-4 py-3">Slug</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Last updated</th>
                        <th className="px-4 py-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {pages.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {p.title}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
                              /{p.slug}
                            </code>
                          </td>
                          <td className="px-4 py-3">
                            {p.isPublished ? (
                              <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
                                <Eye className="mr-1 h-3 w-3" /> Published
                              </Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
                                <EyeOff className="mr-1 h-3 w-3" /> Draft
                              </Badge>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {fmtDate(p.updatedAt)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <a
                                href={`/${p.slug}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                title="View public page"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                              <button
                                onClick={() => setEditorState({ mode: 'edit', id: p.id })}
                                className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                                title="Edit"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => {
                                  if (
                                    confirm(
                                      `Delete the "${p.title}" page? This removes it from the public site immediately.`,
                                    )
                                  ) {
                                    deleteMutation.mutate(p.id);
                                  }
                                }}
                                className="inline-flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-red-50 hover:text-red-600"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {editorState.mode !== 'closed' && (
        <StaticPageEditor
          key={editorState.mode === 'edit' ? editorState.id : 'new'}
          mode={editorState.mode}
          pageId={editorState.mode === 'edit' ? editorState.id : undefined}
          onClose={() => setEditorState({ mode: 'closed' })}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'static-pages'] });
            setEditorState({ mode: 'closed' });
          }}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EDITOR DRAWER
// ═══════════════════════════════════════════════════════════════════════════

interface EditorProps {
  mode: 'create' | 'edit';
  pageId?: string;
  onClose: () => void;
  onSaved: () => void;
}

function StaticPageEditor({ mode, pageId, onClose, onSaved }: EditorProps) {
  const isEditing = mode === 'edit';

  const { data: existing, isLoading: loadingExisting } = useQuery<StaticPageFull>({
    queryKey: ['admin', 'static-pages', pageId],
    queryFn: async () => {
      const { data } = await api.get(`/admin/static-pages/${pageId}`);
      return data;
    },
    enabled: isEditing && !!pageId,
  });

  // Form state — seeded once the initial GET resolves (edit) or immediately (create).
  const [slug, setSlug] = useState(existing?.slug ?? '');
  const [title, setTitle] = useState(existing?.title ?? '');
  const [metaTitle, setMetaTitle] = useState(existing?.metaTitle ?? '');
  const [metaDescription, setMetaDescription] = useState(
    existing?.metaDescription ?? '',
  );
  const [eyebrow, setEyebrow] = useState(existing?.eyebrow ?? '');
  const [subtitle, setSubtitle] = useState(existing?.subtitle ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [isPublished, setIsPublished] = useState(existing?.isPublished ?? true);
  const [hydrated, setHydrated] = useState(!isEditing);

  // When edit-mode data lands, copy into form (once).
  if (isEditing && existing && !hydrated) {
    setSlug(existing.slug);
    setTitle(existing.title);
    setMetaTitle(existing.metaTitle ?? '');
    setMetaDescription(existing.metaDescription ?? '');
    setEyebrow(existing.eyebrow ?? '');
    setSubtitle(existing.subtitle ?? '');
    setBody(existing.body);
    setIsPublished(existing.isPublished);
    setHydrated(true);
  }

  const saveMutation = useMutation({
    mutationFn: async (payload: UpsertPayload) => {
      if (isEditing && pageId) {
        return api.put(`/admin/static-pages/${pageId}`, payload);
      }
      return api.post('/admin/static-pages', payload);
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Page saved' : 'Page created');
      onSaved();
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Failed to save page');
    },
  });

  const handleSave = () => {
    if (slug.trim().length < 2) {
      toast.error('Slug is required');
      return;
    }
    if (title.trim().length < 2) {
      toast.error('Title is required');
      return;
    }
    if (body.trim().length < 10) {
      toast.error('Body is too short');
      return;
    }
    saveMutation.mutate({
      slug: slug.trim(),
      title: title.trim(),
      metaTitle: metaTitle.trim() || undefined,
      metaDescription: metaDescription.trim() || undefined,
      eyebrow: eyebrow.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      body,
      isPublished,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="flex-1 bg-black/30"
        onClick={() => !saveMutation.isPending && onClose()}
      />
      {/* Drawer */}
      <div className="flex w-full max-w-3xl flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {isEditing ? 'Edit Page' : 'New Page'}
          </h2>
          <button
            onClick={onClose}
            disabled={saveMutation.isPending}
            className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-40"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isEditing && loadingExisting ? (
          <div className="flex-1 space-y-4 p-6">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <>
            <div className="flex-1 space-y-5 overflow-y-auto p-6">
              {/* Slug + Title */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Slug (URL)
                  </label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="privacy"
                    disabled={isEditing}
                  />
                  {isEditing && (
                    <p className="mt-1 text-xs text-gray-400">
                      Slug changes are disabled to protect inbound links.
                    </p>
                  )}
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Title (H1)
                  </label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Privacy Policy"
                  />
                </div>
              </div>

              {/* Eyebrow + Publish toggle */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Eyebrow (optional)
                  </label>
                  <Input
                    value={eyebrow}
                    onChange={(e) => setEyebrow(e.target.value)}
                    placeholder="Legal"
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Small uppercase label above the title.
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Status
                  </label>
                  <label className="flex items-center gap-2 rounded-md border bg-white px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isPublished}
                      onChange={(e) => setIsPublished(e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-purple-600"
                    />
                    <span className="text-sm text-gray-700">
                      {isPublished ? 'Published — publicly visible' : 'Draft — hidden'}
                    </span>
                  </label>
                </div>
              </div>

              {/* Subtitle */}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Subtitle (optional, italic serif intro)
                </label>
                <Input
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="A short intro paragraph rendered below the title"
                />
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Meta title (SEO)
                  </label>
                  <Input
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    placeholder="Privacy Policy | Spiritual California"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                    Meta description (SEO)
                  </label>
                  <Input
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    placeholder="Short summary for Google results"
                  />
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">
                  Body
                </label>
                <RichTextEditor
                  value={body}
                  onChange={setBody}
                  placeholder="Write the full page content…"
                  minHeight="320px"
                  extended
                />
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-3 border-t bg-gray-50 px-6 py-3">
              <button
                onClick={onClose}
                disabled={saveMutation.isPending}
                className="rounded-md border bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="rounded-md bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
              >
                {saveMutation.isPending
                  ? 'Saving…'
                  : isEditing
                    ? 'Save Changes'
                    : 'Create Page'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
