'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { C, font, formatPrice, PageHeader, Panel, Btn, EmptyState, ProductThumb, Modal, FormGroup, Input, TextArea, Select } from '@/components/guide/dashboard-ui';

interface DigitalFile {
  name: string;
  size: number;
  data: string; // base64 data URL (will be S3 key when wired)
}

interface Product {
  id: string; name: string; description: string | null; type: string;
  price: number | string; imageUrls: string[]; stockQuantity: number | null;
  fileS3Key: string | null;
  digitalFiles: DigitalFile[] | null;
}

const emptyForm = { name: '', description: '', type: 'DIGITAL', price: '', stockQuantity: '' };

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
      price: String(typeof p.price === 'string' ? parseFloat(p.price) : p.price),
      stockQuantity: p.stockQuantity != null ? String(p.stockQuantity) : '',
    });
    setImagePreviews(p.imageUrls || []);
    // Load existing digital files
    if (p.digitalFiles && Array.isArray(p.digitalFiles)) {
      setDigitalFiles(p.digitalFiles);
    } else if (p.fileS3Key) {
      setDigitalFiles([{ name: p.fileS3Key.split('/').pop() || 'Uploaded file', size: 0, data: p.fileS3Key }]);
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

  const handleDigitalFileAdd = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 50MB limit`);
        return;
      }
      if (digitalFiles.length >= 10) {
        toast.error('Maximum 10 files allowed');
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        setDigitalFiles(prev => [...prev, {
          name: file.name,
          size: file.size,
          data: ev.target?.result as string,
        }]);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
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
        price: parseFloat(form.price),
        description: form.description || undefined,
        imageUrls: imagePreviews.length > 0 ? imagePreviews : undefined,
        stockQuantity: form.stockQuantity ? parseInt(form.stockQuantity) : undefined,
        digitalFiles: form.type === 'DIGITAL' && digitalFiles.length > 0
          ? digitalFiles.map(f => ({ name: f.name, size: f.size, url: f.data }))
          : undefined,
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
              <div style={{ fontFamily: font, fontSize: '14px', fontWeight: 500, color: C.charcoal }}>{p.name}</div>
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
                      border: '1px solid rgba(232,184,75,0.3)', borderRadius: '8px',
                    }}>
                      <span style={{ fontSize: '20px' }}>{fileIcon(file.name)}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: font, fontSize: '13px', fontWeight: 500, color: C.charcoal }}>{file.name}</div>
                        <div style={{ fontFamily: font, fontSize: '11px', color: C.warmGray }}>{formatFileSize(file.size)}</div>
                      </div>
                      <button
                        onClick={() => removeDigitalFile(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.warmGray, fontSize: '16px' }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#C0392B')}
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
                Accepted: PDF, ePub, MP3, WAV, MP4, ZIP. Max 10 files, 50MB each. These files will be available for download after purchase.
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
          <Btn onClick={save}>{editingId ? 'Save Changes' : 'Add Product'}</Btn>
        </div>
      </Modal>
    </div>
  );
}
