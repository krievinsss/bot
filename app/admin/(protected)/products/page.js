import { prisma } from '../../../../lib/db.js';
import SimpleCreateForm from '../../../../components/SimpleCreateForm.js';
import ToggleButton from '../../../../components/ToggleButton.js';

function productImageSrc(value){
  if(!value) return null;
  if(value.startsWith('products/')) return `/api/media/product?path=${encodeURIComponent(value)}`;
  try{
    const u=new URL(value);
    if(u.pathname==='/api/media/product'){
      const path=u.searchParams.get('path');
      if(path) return `/api/media/product?path=${encodeURIComponent(path)}`;
    }
  }catch{}
  return value;
}

export default async function Page(){
  const rows=await prisma.product.findMany({orderBy:{createdAt:'desc'}});
  return <>
    <h1 className="text-3xl font-bold mb-6">Products</h1>
    <SimpleCreateForm resource="products" fields={[
      {name:'name',label:'Name',required:true},
      {name:'slug',label:'Slug',required:true},
      {name:'description',label:'Description',type:'textarea',required:true},
      {name:'price',label:'Price',type:'number',step:'0.01',min:'0',required:true},
      {name:'imageUrl',label:'Product image',type:'image',kind:'product'},
      {name:'category',label:'Category'},
      {name:'active',label:'Active',type:'checkbox'}
    ]}/>
    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Image</th><th>Name</th><th>Price</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map(x=>{const src=productImageSrc(x.imageUrl);return <tr key={x.id}>
          <td>{src?<img src={src} alt={x.name} className="h-14 w-14 rounded-lg object-cover border border-slate-700"/>:<span className="muted text-xs">No image</span>}</td>
          <td>{x.name}<div className="muted text-xs">{x.slug}</div></td>
          <td>€{Number(x.price).toFixed(2)}</td>
          <td>{x.active?'Active':'Off'}</td>
          <td><ToggleButton resource="products" id={x.id} field="active" value={!x.active} label={x.active?'Disable':'Enable'}/></td>
        </tr>})}</tbody>
      </table>
    </div>
  </>;
}
