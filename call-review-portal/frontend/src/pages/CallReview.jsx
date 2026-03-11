import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import "./CallReview.css";

const CallReview = () => {

  const { uuid } = useParams();

  const [metadata,setMetadata] = useState({});
  const [metrics,setMetrics] = useState([]);
  const [comments,setComments] = useState("");

  const [isSubmitted,setIsSubmitted] = useState(false);
  const [isEditing,setIsEditing] = useState(false);

  useEffect(()=>{
    fetchCall();
  },[]);

  const fetchCall = async () => {

    try{

      const res = await axiosInstance.get(`/calls/detail/${uuid}/`);

      setMetadata(res.data.metadata);
      setMetrics(res.data.metrics);
      setComments(res.data.comments || "");

      // check if already rated
      const rated = res.data.metrics.some(m => m.value !== null);

      if(rated){
        setIsSubmitted(true);
      }

    }
    catch(err){
      console.error(err);
    }

  };

  const handleRatingChange = (name,value)=>{

    setMetrics(prev =>
      prev.map(m =>
        m.name === name ? {...m,value} : m
      )
    );

  };

  const submitReview = async () => {

    try{

      const ratings = {};

      metrics.forEach(m=>{
        ratings[m.name] = m.value;
      });

      await axiosInstance.post("/calls/consultant-rating/",{
        call_uuid: uuid,
        ratings: ratings,
        comments: comments
      });

      alert("Review Submitted");

      setIsSubmitted(true);
      setIsEditing(false);

    }
    catch(err){
      console.error(err);
    }

  };

  return (

<div className="review-container">

{/* WAVEFORM */}

<div className="waveform">

<img src="/waveform.png" alt="waveform"/>

</div>

<div className="review-body">

{/* LEFT PANEL */}

<div className="metadata">

<h3>Call Metadata</h3>

<p><b>Schema:</b> {metadata.schema_name}</p>
<p><b>Language:</b> {metadata.language}</p>
<p><b>UUID:</b> {metadata.uuid}</p>
<p><b>Mobile:</b> {metadata.phone_number}</p>
<p><b>Date:</b> {metadata.attempt_on_time_stamp}</p>
<p><b>Duration:</b> {metadata.duration}s</p>

<p>
<b>Status:</b>

<span className={`status-badge status-${metadata.status?.toLowerCase().replace(" ","")}`}>
{metadata.status}
</span>

</p>

</div>

{/* RIGHT PANEL */}

<div className="rating-panel">

<h3>Consultant Review</h3>

{metrics.map(m=>(
<div key={m.name} className="metric">

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
placeholder="Comments"
value={comments}
disabled={isSubmitted && !isEditing}
onChange={(e)=>setComments(e.target.value)}
/>

{/* BUTTON LOGIC */}

{!isSubmitted && (

<button className="submit-btn" onClick={submitReview}>
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

<button
className="submit-btn"
onClick={submitReview}
>
Update
</button>

)}

</div>

</div>

</div>

);

};

export default CallReview;