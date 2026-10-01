/* نقطة الدخول على Netlify: تربط المنطق الأساسي بمخزن Netlify Blobs */
import { getStore } from '@netlify/blobs';
import { handle } from './core.mjs';

function adapter(store) {
  return {
    getJSON: async (k) => (await store.get(k, { type: 'json', consistency: 'strong' })) ?? null,
    setJSON: (k, v) => store.setJSON(k, v),
    getBin: async (k) => {
      const b = await store.get(k, { type: 'arrayBuffer', consistency: 'strong' });
      return b ? Buffer.from(b) : null;
    },
    setBin: (k, buf) => store.set(k, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)),
    del: (k) => store.delete(k),
    list: async (prefix) => {
      const keys = [];
      for await (const page of store.list({ prefix, paginate: true })) page.blobs.forEach((b) => keys.push(b.key));
      return keys;
    },
  };
}

// يُنشأ المخزن في كل طلب: رمز الوصول إلى Blobs خاص بكل طلب وتنتهي صلاحيته،
// فإعادة استعمال مخزن قديم في نسخة دافئة تسبب الخطأ "Token expired".
export default async (req) => handle(req, adapter(getStore({ name: 'itqan', consistency: 'strong' })));

export const config = { path: ['/', '/index.html', '/api/*', '/uploads/*'] };
