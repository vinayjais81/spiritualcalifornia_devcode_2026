'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { parsePaymentsGateError } from '@/lib/payments-gate';
import { toast } from 'sonner';
import { C, font, formatPrice, PageHeader, Panel, Btn, EmptyState, ProductThumb, Modal, FormGroup, Input, TextArea, Select } from '@/components/guide/dashboard-ui';

interface DigitalFile {
  name: string;
  size: number;
  s3Key: string;              // S3 key — used by downloads to mint signed URLs
  contentType?: string;
  uploading?: boolean;        // transient — only present during upload
  /** Legacy field kept only so old form state from base64 uploads still hydrates. */
  url?: string;
}

interface Product {
  id: string; name: string; description: string | null; type: string;
  category: string | null;
  price: number | string; imageUrls: string[]; stockQuantity: number | null;
  fileS3Key: string | null;
  digitalFiles: DigitalFile[] | null;
  isActive: boolean;
}

const PRODUCT_CATEGORIES: Array<{ value: string; label: string }> = [
  { value: 'CRYSTALS',          label: 'Crystals' },
  { value: 'SOUND_HEALING',     label: 'Sound Healing' },
  { value: 'AROMATHERAPY',      label: 'Aromatherapy' },
  { value: 'BOOKS_COURSES',     label: 'Books & Courses' },
  { value: 'DIGITAL_DOWNLOADS', label: 'Digital Downloads' },
  { value: 'RITUAL_TOOLS',      label: 'Ritual Tools' },
  { value: 'JEWELRY_MALAS',     label: 'Jewelry & Malas' },
  { value: 'GIFT_BUNDLES',      label: 'Gift Bundles' },
  { value: 'ART',               label: 'Art' },
];

const emptyForm = { name: '', description: '', type: 'DIGITAL', category: '', price: '', stockQuantity: '', isActive: true };

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [digitalFiles, setDigitalFiles] = useState<DigitalFile[]>([]);

  const load = () => api.get('/products/mine').then(r => setProducts(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setImagePreviews([]);
    setDigitalFiles([]);
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      description: p.description || '',
      type: p.type,
      category: p.category || '',
      price: String(typeof p.price === 'string' ? parseFloat(p.price) : p.price),
      stockQuantity: p.stockQuantity != null ? String(p.stockQuantity) : '',
      isActive: p.isActive !== false,
    });
    setImagePreviews(p.imageUrls || []);
    // Load existing digital files — accept either the new {name,size,s3Key} shape
    // or the legacy {name,size,url:"data:..."} shape so older products still edit.
    if (Array.isArray(p.digitalFiles)) {
      setDigitalFiles(
        p.digitalFiles.map((f: any) => ({
          name: f.name || 'Uploaded file',
          size: f.size || 0,
          s3Key: f.s3Key || '',      // empty for legacy base64 rows
          contentType: f.contentType,
          url: f.url,                 // preserved for legacy display only
        })),
      );
    } else if (p.fileS3Key) {
      setDigitalFiles([{
        name: p.fileS3Key.split('/').pop() || 'Uploaded file',
        size: 0,
        s3Key: p.fileS3Key,
      }]);
    } else {
      setDigitalFiles([]);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    setImagePreviews([]);
    setDigitalFiles([]);
  };

  const handleImageAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 5MB limit`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImagePreviews(prev => {
          if (prev.length >= 5) {
            toast.error('Maximum 5 images allowed');
            return prev;
          }
          return [...prev, ev.target?.result as string];
        });
      };
      reader.readAsDataURL(file);
    });
    // Reset input so same files can be selected again
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Map a file's MIME type back to what the backend /upload whitelist accepts.
  // The browser gives us most of these for free, but a couple (Safari m4a) need
  // a hint so S3's Content-Type header matches the signed request.
  const resolveContentType = (file: File): string => {
    if (file.type) return file.type;
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'mp3': return 'audio/mpeg';
      case 'wav': return 'audio/wav';
      case 'flac': return 'audio/flac';
      case 'aac': return 'audio/aac';
      case 'm4a': return 'audio/mp4';
      case 'mp4': return 'video/mp4';
      case 'mov': return 'video/quicktime';
      case 'pdf': return 'application/pdf';
      case 'zip': return 'application/zip';
      case 'rar': return 'application/vnd.rar';
      case 'epub': return 'application/epub+zip';
      case 'mobi': return 'application/x-mobipocket-ebook';
      default: return 'application/octet-stream';
    }
  };

  // Direct browser → S3 upload via pre-signed PUT URL. No base64 in the DB,
  // no request-body size pressure on our API, and the file key is what gets
  // persisted so downloads can mint signed GET URLs later.
  const handleDigitalFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const toUpload = Array.from(files);
    e.target.value = '';

    for (const file of toUpload) {
      if (file.size > 500 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 500MB limit`);
        continue;
      }
      if (digitalFiles.length >= 10) {
        toast.error('Maximum 10 files allowed');
        break;
      }

      // Optimistic placeholder so the guide sees upload progress
      const placeholder: DigitalFile = {
        name: file.name,
        size: file.size,
        s3Key: '',
        uploading: true,
      };
      setDigitalFiles(prev => [...prev, placeholder]);
      const placeholderIndex = digitalFiles.length; // captured before state updates flush

      try {
        const contentType = resolveContentType(file);
        const { data: presigned } = await api.get('/upload/presigned-url', {
          params: { folder: 'products', fileName: file.name, contentType },
        });
        // Upload the raw file bytes directly to S3 — our API never touches the body.
        const putRes = await fetch(presigned.uploadUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': contentType },
        });
        if (!putRes.ok) {
          throw new Error(`S3 upload failed (${putRes.status})`);
        }
        // Swap the placeholder for the real record
        setDigitalFiles(prev => prev.map((f, i) =>
          i === placeholderIndex && f.uploading
            ? { name: file.name, size: file.size, s3Key: presigned.key, contentType }
            : f,
        ));
      } catch (err: any) {
        toast.error(`${file.name}: ${err?.message || 'upload failed'}`);
        // Drop the failed placeholder
        setDigitalFiles(prev => prev.filter((f, i) => !(i === placeholderIndex && f.uploading)));
      }
    }
  };

  const removeDigitalFile = (index: number) => {
    setDigitalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return 'Uploaded';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const fileIcon = (name: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return '📄';
    if (['mp3', 'wav', 'flac', 'aac'].includes(ext || '')) return '🎵';
    if (['mp4', 'mov', 'avi'].includes(ext || '')) return '🎬';
    if (['zip', 'rar'].includes(ext || '')) return '📦';
    if (['epub', 'mobi'].includes(ext || '')) return '📚';
    return '📎';
  };

  const save = async () => {
    try {
      const payload: any = {
        name: form.name,
        type: form.type,
        category: form.category || undefined,
        price: parseFloat(form.price),
        description: form.description || undefined,
        imageUrls: imagePreviews.length > 0 ? imagePreviews : undefined,
        stockQuantity: form.stockQuantity ? parseInt(form.stockQuantity) : undefined,
        digitalFiles: form.type === 'DIGITAL' && digitalFiles.length > 0
          ? digitalFiles
              // Drop any uploads still in-flight so we never persist an empty s3Key
              .filter(f => !f.uploading && f.s3Key)
              .map(f => ({ name: f.name, size: f.size, s3Key: f.s3Key, contentType: f.contentType }))
          : undefined,
        isActive: form.isActive,
      };

      if (editingId) {
        await api.put(`/products/${editingId}`, payload);
        toast.success('Product updated');
      } else {
        await api.post('/products', payload);
        toast.success('Product created');
      }
      closeModal();
      load();
    } catch (err: any) {
      // Payments Publish Gate: paid product without Stripe Connect returns
      // a structured 403; the server still saved the row as a draft. The
      // global axios interceptor opens the PaymentsGateModal — silence the
      // generic toast and refresh the list so the draft shows up.
      if (parsePaymentsGateError(err)) {
        closeModal();
        load();
        return;
      }
      toast.error(err?.response?.data?.message || 'Failed to save product');
    }
  };

  const remove = async (id: string) => {
    try { await api.delete(`/products/${id}`); setProducts(p => p.filter(x => x.id !== id)); toast.success('Product deleted'); } catch { toast.error('Failed to delete'); }
  };

  return (
    <div>
      <PageHeader title="Products" subtitle="Sell physical or digital products directly from your profile.">
        <Btn onClick={openCreate}>+ Add Product</Btn>
      </PageHeader>
      <Panel title="Your Products" icon="🛍️">
        {products.length === 0 ? <EmptyState message="No products yet." /> : products.map(p => (
          <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 100px auto 36px', gap: '12px', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(232,184,75,0.1)' }}>
            <ProductThumb imageUrls={p.imageUrls} type={p.type} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{p.name}</div>
                {p.isActive === false && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 10,
                    background: 'rgba(232,184,75,0.15)',
                    color: '#B8960F', fontSize: 10, fontWeight: 600,
                    letterSpacing: '0.06em', textTransform: 'uppercase',
                  }}>
                    Hidden
                  </span>
                )}
              </div>
              <div style={{ fontFamily: font, fontSize: '12px', color: C.warmGray, marginTop: '2px' }}>
                {p.type === 'DIGITAL' ? 'Digital Download' : 'Physical Product'}
                {p.imageUrls?.length > 0 && ` · ${p.imageUrls.length} image${p.imageUrls.length > 1 ? 's' : ''}`}
              </div>
            </div>
            <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{formatPrice(p.price)}</div>
            <Btn variant="secondary" size="sm" onClick={() => openEdit(p)}>Edit</Btn>
            <button onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.warmGray, fontSize: '18px' }}>×</button>
          </div>
        ))}
      </Panel>

      {/* Create / Edit Modal */}
      <Modal open={showModal} onClose={closeModal} title={editingId ? 'Edit Product' : 'Add New Product'}>
        {/* Publish toggle — appears above all fields so it's the first thing the guide sees. */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 16, marginBottom: 20, padding: '14px 18px',
          background: form.isActive ? 'rgba(90,138,106,0.08)' : 'rgba(232,184,75,0.08)',
          border: `1.5px solid ${form.isActive ? 'rgba(90,138,106,0.35)' : 'rgba(232,184,75,0.35)'}`,
          borderRadius: 10,
        }}>
          <div>
            <div style={{ fontFamily: font, fontSize: 13, fontWeight: 500, color: C.charcoal, marginBottom: 2 }}>
              {form.isActive ? '🟢 Active — visible on shop' : '⏸️ Inactive — hidden draft'}
            </div>
            <div style={{ fontFamily: font, fontSize: 11, color: C.warmGray, lineHeight: 1.5 }}>
              {form.isActive
                ? 'Seekers can see this product on the public shop page and buy it immediately.'
                : 'Only you can see this product. Switch to Active to publish it.'}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={form.isActive}
            onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
            style={{
              position: 'relative', flexShrink: 0,
              width: 48, height: 26, borderRadius: 13,
              border: 'none', cursor: 'pointer',
              background: form.isActive ? '#5A8A6A' : '#C4BEB6',
              transition: 'background 0.2s',
            }}
          >
            <span
              style={{
                position: 'absolute', top: 3,
                left: form.isActive ? 25 : 3,
                width: 20, height: 20, borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                transition: 'left 0.2s',
              }}
            />
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <FormGroup label="Product Name" full>
            <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Himalayan Singing Bowl Set" />
          </FormGroup>
          <FormGroup label="Description" full>
            <TextArea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the product..." />
          </FormGroup>
          <FormGroup label="Price (USD)">
            <Input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="85" min="0" />
          </FormGroup>
          <FormGroup label="Product Type">
            <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              <option value="DIGITAL">Digital Download</option>
              <option value="PHYSICAL">Physical Product</option>
            </Select>
          </FormGroup>
          <FormGroup label="Shop Category — drives /shop filter tabs">
            <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
              <option value="">Uncategorized (only in &ldquo;All&rdquo;)</option>
              {PRODUCT_CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </Select>
          </FormGroup>
          {form.type === 'PHYSICAL' && (
            <FormGroup label="Stock Quantity">
              <Input type="number" value={form.stockQuantity} onChange={e => setForm(f => ({ ...f, stockQuantity: e.target.value }))} placeholder="50" min="0" />
            </FormGroup>
          )}

          {/* Digital Files Upload — only for Digital products */}
          {form.type === 'DIGITAL' && (
            <FormGroup label={`Downloadable Files (${digitalFiles.length}/10)`} full>
              {digitalFiles.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {digitalFiles.map((file, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '10px 14px', background: C.offWhite,
                      border: `1px solid ${file.uploading ? 'rgba(138,130,120,0.35)' : 'rgba(232,184,75,0.3)'}`,
                      borderRadius: '8px', opacity: file.uploading ? 0.7 : 1,
                    }}>
                      <span style={{ fontSize: '20px' }}>{file.uploading ? '⏳' : fileIcon(file.name)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>{file.name}</div>
                        <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>
                          {file.uploading ? 'Uploading to secure storage…' : formatFileSize(file.size)}
                        </div>
                      </div>
                      <button
                        onClick={() => removeDigitalFile(i)}
                        disabled={file.uploading}
                        style={{
                          background: 'none', border: 'none',
                          cursor: file.uploading ? 'not-allowed' : 'pointer',
                          color: C.warmGray, fontSize: '16px',
                          opacity: file.uploading ? 0.4 : 1,
                        }}
                        onMouseEnter={e => { if (!file.uploading) (e.currentTarget.style.color = '#C0392B'); }}
                        onMouseLeave={e => (e.currentTarget.style.color = C.warmGray)}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {digitalFiles.length < 10 && (
                <label style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px',
                  padding: '8px 16px', fontFamily: font, fontSize: '12px', fontWeight: 500,
                  background: C.goldPale, border: '1.5px solid rgba(232,184,75,0.5)',
                  borderRadius: '6px', cursor: 'pointer', color: C.charcoal,
                }}>
                  📎 Upload Files
                  <input
                    type="file"
                    accept=".pdf,.epub,.mobi,.mp3,.wav,.flac,.aac,.mp4,.mov,.zip,.rar"
                    multiple
                    onChange={handleDigitalFileAdd}
                    style={{ display: 'none' }}
                  />
                </label>
              )}
              <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, marginTop: '6px' }}>
                Accepted: PDF, ePub, MOBI, MP3, WAV, FLAC, AAC, MP4, MOV, ZIP, RAR. Max 10 files, 500MB each. Files are stored securely on S3 and made available to seekers immediately after purchase.
              </div>
            </FormGroup>
          )}

          {/* Product Images */}
          <FormGroup label={`Product Images (${imagePreviews.length}/5)`} full>
            {imagePreviews.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                {imagePreviews.map((img, i) => (
                  <div key={i} style={{ position: 'relative', width: '100px', height: '100px', borderRadius: '8px', overflow: 'hidden', border: `1.5px solid rgba(232,184,75,0.3)` }}>
                    <img
                      src={img}
                      alt={`Product ${i + 1}`}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                    {/* First image badge */}
                    {i === 0 && (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'rgba(232,184,75,0.9)', color: C.white,
                        fontFamily: font, fontSize: '9px', fontWeight: 600,
                        textAlign: 'center', padding: '2px 0',
                        letterSpacing: '0.08em', textTransform: 'uppercase',
                      }}>
                        Cover
                      </div>
                    )}
                    {/* Remove button */}
                    <button
                      onClick={() => removeImage(i)}
                      style={{
                        position: 'absolute', top: '4px', right: '4px',
                        width: '20px', height: '20px', borderRadius: '50%',
                        background: 'rgba(0,0,0,0.5)', color: '#fff',
                        border: 'none', cursor: 'pointer', fontSize: '12px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            {imagePreviews.length < 5 && (
              <label style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '8px 16px', fontFamily: font, fontSize: '12px', fontWeight: 500,
                background: C.goldPale, border: '1.5px solid rgba(232,184,75,0.5)',
                borderRadius: '6px', cursor: 'pointer', color: C.charcoal,
              }}>
                📁 {imagePreviews.length > 0 ? 'Add More Images' : 'Upload Product Images'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  onChange={handleImageAdd}
                  style={{ display: 'none' }}
                />
              </label>
            )}
            <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray, marginTop: '6px' }}>
              First image is used as the cover. Max 5 images, 5MB each.
            </div>
          </FormGroup>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
          <Btn variant="secondary" onClick={closeModal}>Cancel</Btn>
          <Btn
            onClick={save}
            disabled={digitalFiles.some(f => f.uploading)}
          >
            {digitalFiles.some(f => f.uploading)
              ? 'Uploading files…'
              : editingId ? 'Save Changes' : 'Add Product'}
          </Btn>
        </div>
      </Modal>
    </div>
  );
}
