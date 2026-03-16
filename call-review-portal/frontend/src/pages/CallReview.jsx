import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import AudioPlayer from "../components/AudioPlayer";
import DashboardHeader from "../components/DashboardHeader";
import "./CallReview.css";
const CallReview = () => {
  const { uuid } = useParams();

  const [metadata, setMetadata] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [comments, setComments] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isEditable, setIsEditable] = useState(true);
  const [lockMessage, setLockMessage] = useState("");

  useEffect(() => {
    fetchCall();
  }, [uuid]);

  const fetchCall = async () => {
    try {
      const detailRes = await axiosInstance.get(`/calls/detail/${uuid}/`);

      setMetadata(detailRes.data.metadata || {});
      setMetrics(detailRes.data.metrics || []);
      setComments(detailRes.data.comments || "");

      if (detailRes.data.is_locked) {
        setIsEditable(false);
        setIsSubmitted(true);
        setLockMessage("Lead is reviewing this call. Editing temporarily disabled.");
      } else if (["Need Fix", "Approved"].includes(detailRes.data.metadata?.status)) {
        setIsEditable(false);
        setIsSubmitted(true);
        setLockMessage("Lead reviewed this call. You cannot update.");
      } else {
        setIsEditable(true);
        setLockMessage("");

        const rated = (detailRes.data.metrics || []).some(
          (m) => m.value !== null && m.value !== ""
        );
        setIsSubmitted(rated);
      }

      try {
        const audioRes = await axiosInstance.get(`/calls/audio/${uuid}/`);
        setAudioUrl(audioRes.data.audio_url || "");
      } catch (audioErr) {
        console.warn("Audio fetch failed:", audioErr);
        setAudioUrl("");
      }
    } catch (err) {
      console.error("Call detail fetch failed:", err);
      alert("Failed to load call details");
    }
  };

  const handleRatingChange = (name, value) => {
    setMetrics((prev) =>
      prev.map((m) => (m.name === name ? { ...m, value } : m))
    );
  };

  const submitReview = async () => {
    try {
      const ratings = {};

      metrics.forEach((m) => {
        if (m.value !== null && m.value !== "") {
          ratings[m.name] = Number(m.value);
        }
      });

      await axiosInstance.post("/calls/consultant-rating/", {
        call_uuid: uuid,
        ratings,
        comments,
      });

      alert(isEditing ? "Review Updated" : "Review Submitted");
      setIsSubmitted(true);
      setIsEditing(false);

      setMetadata((prev) => ({
        ...prev,
        status: "Completed",
      }));
    } catch (err) {
      console.error("Submit failed:", err);
      alert("Failed to submit review");
    }
  };

  return (
    <div className="review-page">
      <div className="review-container">
        <DashboardHeader title="Consultant Dashboard" />

        {audioUrl ? (
          <AudioPlayer audioUrl={audioUrl} />
        ) : (
          <div className="audio-unavailable">Audio not available</div>
        )}

        <div className="review-body">
          <div className="metadata">
            <h3>Call Metadata</h3>
            <p><b>Schema:</b> {metadata.schema_name || "-"}</p>
            <p><b>Language:</b> {metadata.language || "-"}</p>
            <p><b>UUID:</b> {metadata.uuid || "-"}</p>
            <p><b>Mobile:</b> {metadata.phone_number || "-"}</p>
            <p><b>Date:</b> {metadata.attempt_on_time_stamp || "-"}</p>
            <p>
              <b>Duration:</b>{" "}
              {metadata.duration != null
                ? `${Math.floor(metadata.duration / 60)}m ${metadata.duration % 60}s`
                : "-"}
            </p>
            <p>
              <b>Status:</b>{" "}
              <span
                className={`status-badge status-${(metadata.status || "")
                  .toLowerCase()
                  .replace(/\s+/g, "")}`}
              >
                {metadata.status || "-"}
              </span>
            </p>
          </div>

          <div className="rating-panel">
            <h3>Consultant Review</h3>

            {metrics.length === 0 ? (
              <p style={{ color: "#666" }}>No metrics available</p>
            ) : (
              metrics.map((m) => (
                <div key={m.name} className="metric">
                  <label>{m.name}</label>
                  <input
                    type="number"
                    min={m.min}
                    max={m.max}
                    value={m.value ?? ""}
                    disabled={!isEditable || (isSubmitted && !isEditing)}
                    onChange={(e) => handleRatingChange(m.name, e.target.value)}
                  />
                  <p
                    className="rating-range"
                    style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}
                  >
                    Allowed: {m.min} - {m.max}
                  </p>
                </div>
              ))
            )}

            <textarea
              placeholder="Comments"
              value={comments}
              disabled={!isEditable || (isSubmitted && !isEditing)}
              onChange={(e) => setComments(e.target.value)}
            />

            {!isSubmitted && isEditable && (
              <button className="submit-btn" onClick={submitReview}>
                Submit
              </button>
            )}

            {isSubmitted && isEditable && !isEditing && (
              <button className="edit-btn" onClick={() => setIsEditing(true)}>
                Edit
              </button>
            )}

            {isEditing && isEditable && (
              <button className="submit-btn" onClick={submitReview}>
                Update
              </button>
            )}

            {!isEditable && (
              <p style={{ fontSize: "12px", color: "#999", marginTop: "8px" }}>
                {lockMessage}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallReview;