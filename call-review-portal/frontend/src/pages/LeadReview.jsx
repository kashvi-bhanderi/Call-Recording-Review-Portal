import React,{useEffect,useState} from "react";
import {useParams} from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import "./LeadReview.css";

const LeadReview=()=>{

const {uuid}=useParams();

const[metadata,setMetadata]=useState({});
const[consultant,setConsultant]=useState({});
const[metrics,setMetrics]=useState([]);

const[leadComment,setLeadComment]=useState("");
const[status,setStatus]=useState("");
const[tags,setTags]=useState([]);

const[tagOptions,setTagOptions]=useState([]);

const[isSubmitted,setIsSubmitted]=useState(false);
const[isEditing,setIsEditing]=useState(false);

useEffect(()=>{
fetchCall();
},[]);

const fetchCall=async()=>{

const res=await axiosInstance.get(`/calls/lead-detail/${uuid}/`);

setMetadata(res.data.metadata);
setConsultant(res.data.consultant_review);
setMetrics(res.data.metrics);

setLeadComment(res.data.lead_comment||"");
setStatus(res.data.status ?? "");

setTagOptions(res.data.tag_options);
setTags(res.data.selected_tags || []);

// check if already rated
const rated=res.data.metrics.some(m=>m.value!==null);
const statusFinalized = ["Need Fix", "Approved"].includes(res.data.metadata.status);

if(statusFinalized){
setIsSubmitted(true);
setIsEditing(false);
}
// if(rated){
// setIsSubmitted(true);
// }

};

const handleRatingChange=(name,value)=>{

setMetrics(prev=>
prev.map(m=>
m.name===name?{...m,value}:m
)
);

};

const submitReview=async()=>{

if(!status){
alert("Please select status");
return;
}

const ratings={};

metrics.forEach(m=>{
ratings[m.name]=m.value;
});

await axiosInstance.post("/calls/lead-rating/",{

call_uuid:uuid,
ratings:ratings,
comment:leadComment,
status:Number(status),
tags:tags

});

alert("Lead Review Submitted");

setIsSubmitted(true);
setIsEditing(false);

await fetchCall();

};

return(

<div className="review-container">

{/* Waveform */}

<div className="waveform">
<img src="/waveform.png" alt="waveform"/>
</div>

<div className="review-body">

{/* Metadata */}

<div className="metadata">

<h3>Call Metadata</h3>

<p><b>Schema:</b> {metadata.schema_name}</p>
<p><b>Language:</b> {metadata.language}</p>
<p><b>UUID:</b> {metadata.uuid}</p>
<p><b>Phone:</b> {metadata.phone_number}</p>
<p><b>Date:</b> {metadata.attempt_on_time_stamp}</p>

<p>
<b>Duration:</b>
{metadata.duration != null ? `${Math.floor(metadata.duration/60)}m ${metadata.duration%60}s` : "-"}
</p>

<p>
<b>Status:</b>
<span className={`status-badge status-${metadata.status?.toLowerCase().replace(" ","")}`}>
{metadata.status}
</span>
</p>

</div>

{/* Lead Rating Panel */}

<div className="rating-panel">

<h3>Lead Review</h3>

{metrics.map((m,i)=>(

<div key={i} className="metric">

<label>{m.name}</label>

<input
type="number"
min={m.min}
max={m.max}
value={m.value || ""}
disabled={isSubmitted && !isEditing}
onChange={(e)=>handleRatingChange(m.name,e.target.value)}
/>

</div>
))}

<textarea
placeholder="Lead Comment"
value={leadComment}
disabled={isSubmitted && !isEditing}
onChange={(e)=>setLeadComment(e.target.value)}
/>

<select
value={status || ""}
disabled={isSubmitted && !isEditing}
onChange={(e) => {
    const val = e.target.value;
    setStatus(val === "" ? "" : Number(val));
}}
>

<option value="">Select Status</option>
<option value={3}>Need Fix</option>
<option value={4}>Approved</option>

</select>

<select
multiple
value={tags}
disabled={isSubmitted && !isEditing}
onChange={(e)=>
setTags([...e.target.selectedOptions].map(o=>Number(o.value)))
}
>

{tagOptions.map(t=>(
<option key={t.id} value={t.id}>{t.name}</option>
))}

</select>

{/* BUTTON LOGIC */}

{!isSubmitted && (

<button onClick={submitReview}>
Submit
</button>

)}

{isSubmitted && !isEditing && (

<button
className="edit-btn"
onClick={()=>setIsEditing(true)}
>
Edit
</button>

)}

{isEditing && (

<button onClick={submitReview}>
Update
</button>

)}

</div>

{/* Consultant Review */}

<div className="rating-panel">

<h3>Consultant Review</h3>

{consultant.ratings?.map((r,i)=>(
<div key={i} className="metric">

<label>{r.metric}</label>

<input value={r.value} readOnly/>

</div>
))}

<textarea value={consultant.comment||""} readOnly/>

<p>Submitted: {consultant.timestamp}</p>

</div>

</div>

</div>

);

};

export default LeadReview;
