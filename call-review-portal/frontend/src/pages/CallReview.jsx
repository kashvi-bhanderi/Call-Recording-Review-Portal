import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axiosInstance from "../api/axiosInstance";
import AudioPlayer from "../components/AudioPlayer";
import DashboardHeader from "../components/DashboardHeader";
import StarRating from "../components/starrating";
import "./CallReview.css";
import toast from "react-hot-toast";

const CallReview = () => {
  const { uuid } = useParams();

  const [metadata, setMetadata] = useState({});
  const [metrics, setMetrics] = useState([]);
  const [comments, setComments] = useState("");
  const [audioUrl, setAudioUrl] = useState("");

  const [leadMetrics, setLeadMetrics] = useState([]);
  const [leadComment, setLeadComment] = useState("");

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
      const data = detailRes.data;

      setMetadata(data.metadata || {});
      setMetrics(data.metrics || []);
      setComments(data.comments || "");
      setLeadMetrics(data.lead_metrics || []);
      setLeadComment(data.lead_comment || "");

      const rated = (data.metrics || []).some(
        (m) => m.value !== null && m.value !== ""
      );

      if (data.is_locked) {
        setIsEditable(false);
        setIsEditing(false);
        setIsSubmitted(rated);

        if (data.lock_reason === "permanent") {
          setLockMessage("Lead reviewed this call. You cannot update it.");
        } else if (data.lock_reason === "temporary") {
          setLockMessage("Lead is reviewing this call. Editing temporarily disabled.");
        } else if (data.lock_reason === "consultant_taken") {
          setLockMessage("Another consultant already rated this call.");
        } else {
          setLockMessage("This call is locked.");
        }
      } else {
        setIsEditable(true);
        setLockMessage("");
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
      toast.error("Failed to load call details");
    }
  };

  const handleRatingChange = (name, value) => {
    setMetrics((prev) =>
      prev.map((m) => (m.name === name ? { ...m, value } : m))
    );
  };

  const submitReview = async () => {
     if (!allMetricsFilled) {
    toast.error("Please rate all fields before submitting.");
    return;
  }
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

      toast.success(isEditing ? "Review updated successfully" : "Review submitted successfully");

      setIsSubmitted(true);
      setIsEditing(false);

      await fetchCall();
    } catch (err) {
      console.error("Submit failed:", err);
      const msg = err.response?.data?.error || "Failed to submit review";
      toast.error(msg);
      fetchCall();
    }
  };

const disableInputs = !isEditable || (isSubmitted && !isEditing);

const allMetricsFilled =
  metrics.length > 0 &&
  metrics.every((m) => m.value !== null && m.value !== "");

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
            <p><b>Organization:</b> {metadata.org_name || metadata.schema_name || "-"}</p>
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
            {metadata.rated_by && (
              <p><b>Rated By:</b> {metadata.rated_by}</p>
            )}
          </div>

          <div className="rating-panel">
            <h3>Consultant Review</h3>

            {metrics.length === 0 ? (
              <p style={{ color: "#666" }}>No metrics available</p>
            ) : (
              metrics.map((m) => {
                const useStars = Number(m.max) <= 5;

                return (
                  <div key={m.name} className="metric">
                    <label>{m.name}</label>

                    {useStars ? (
                      <StarRating
                        value={m.value ?? 0}
                        min={Number(m.min) || 1}
                        max={Number(m.max) || 5}
                        disabled={disableInputs}
                        onChange={(val) => handleRatingChange(m.name, val)}
                      />
                    ) : (
                      <input
                        type="number"
                        min={m.min}
                        max={m.max}
                        value={m.value ?? ""}
                        disabled={disableInputs}
                        onChange={(e) => handleRatingChange(m.name, e.target.value)}
                      />
                    )}

                    <p
                      className="rating-range"
                      style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}
                    >
                      Allowed: {m.min} - {m.max}
                    </p>
                  </div>
                );
              })
            )}

            <textarea
              placeholder="Comments"
              value={comments}
              disabled={disableInputs}
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
              <p style={{ fontSize: "12px", color: "#dc2626", marginTop: "8px" }}>
                {lockMessage}
              </p>
            )}
          </div>

          {leadMetrics.length > 0 && (
            <div className="rating-panel">
              <h3>Lead Final Review</h3>

              {leadMetrics.map((m) => {
                const useStars = Number(m.max) <= 5;

                return (
                  <div key={m.name} className="metric">
                    <label>{m.name}</label>

                    {useStars ? (
                      <StarRating
                        value={m.value ?? 0}
                        min={Number(m.min) || 1}
                        max={Number(m.max) || 5}
                        disabled={true}
                        readOnly={true}
                      />
                    ) : (
                      <input
                        type="number"
                        min={m.min}
                        max={m.max}
                        value={m.value ?? ""}
                        disabled={true}
                        readOnly
                      />
                    )}

                    <p
                      className="rating-range"
                      style={{ fontSize: "11px", color: "#666", marginTop: "2px" }}
                    >
                      Allowed: {m.min} - {m.max}
                    </p>
                  </div>
                );
              })}

              <textarea
                placeholder="Lead Comment"
                value={leadComment}
                disabled={true}
                readOnly
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CallReview;