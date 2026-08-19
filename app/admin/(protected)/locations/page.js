import { prisma } from '../../../../lib/db.js';
import SimpleCreateForm from '../../../../components/SimpleCreateForm.js';
import ToggleButton from '../../../../components/ToggleButton.js';

export default async function Page(){
  const [cities,rows]=await Promise.all([
    prisma.city.findMany({where:{active:true},orderBy:{name:'asc'}}),
    prisma.location.findMany({include:{city:true},orderBy:{createdAt:'desc'}})
  ]);

  return <>
    <h1 className="text-3xl font-bold mb-6">Locations</h1>
    <SimpleCreateForm resource="locations" fields={[
      {name:'cityId',type:'select',options:cities.map(c=>({value:c.id,label:c.name})),required:true},
      {name:'name',label:'Internal name',required:true},
      {name:'publicName',label:'Public name'},
      {name:'privateAddress',label:'Exact private address',required:true},
      {name:'latitude',label:'Latitude',required:true},
      {name:'longitude',label:'Longitude',required:true},
      {name:'privateInstructions',label:'Private pickup instructions',type:'textarea'},
      {name:'privateImagePath',label:'Private location image',type:'image',kind:'private'},
      {name:'active',label:'Active',type:'checkbox'}
    ]}/>

    <div className="card overflow-x-auto">
      <table className="table">
        <thead><tr><th>Image</th><th>City</th><th>Name</th><th>Status</th><th></th></tr></thead>
        <tbody>{rows.map(x=><tr key={x.id}>
          <td>{x.privateImagePath?<img src={`/api/admin/media?path=${encodeURIComponent(x.privateImagePath)}`} alt={x.name} className="h-14 w-14 rounded-lg object-cover border border-slate-700"/>:<span className="muted text-xs">No image</span>}</td>
          <td>{x.city.name}</td>
          <td>{x.name}</td>
          <td>{x.active?'Active':'Off'}</td>
          <td><ToggleButton resource="locations" id={x.id} field="active" value={!x.active} label={x.active?'Disable':'Enable'}/></td>
        </tr>)}</tbody>
      </table>
    </div>
  </>;
}
