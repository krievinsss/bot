import { put, del } from '@vercel/blob';
export async function uploadPublicImage(file,prefix='products'){ return put(`${prefix}/${crypto.randomUUID()}-${file.name}`,file,{access:'public',addRandomSuffix:true}); }
export async function uploadPrivateImage(file){ return put(`private/${crypto.randomUUID()}-${file.name}`,file,{access:'private',addRandomSuffix:true}); }
export async function removeBlob(url){ if(url) await del(url); }
